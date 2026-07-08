import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-shared-kpis',
  standalone: false,
  templateUrl: './shared-kpis.component.html',
  styleUrls: ['./shared-kpis.component.scss']
})
export class SharedKpisComponent implements OnChanges {
  @Input() kpisMain: any = null;     // I KPI dello scenario base/sinistro
  @Input() kpisCompare?: any = null; // Se presente, attiva la modalità comparazione

  kpiKeys: string[] = [];
  criticalConstraintKey: string | null = null;

  get isComparison(): boolean {
    return !!this.kpisCompare;
  }

  ngOnChanges() {
    if (!this.kpisMain) return;

    // 1. Escludi le chiavi di sistema 
    const excluded = ['critical constraint', 'critical_constraint', 'uncertainty', 'uncertainty_by_constraint'];
    let keys = Object.keys(this.kpisMain).filter(k => !excluded.includes(k));

    // 2. Trova eventuale vincolo critico (badge rosso in visualizzazione singola)
    const cc = this.kpisMain['critical_constraint'] || this.kpisMain['critical constraint'];
    this.criticalConstraintKey = (cc && typeof cc === 'object' && cc.name) ? `constraint_level_${cc.name}` : null;

    // 3. Ordina: prima overtourism, poi constraint critico (se esiste), poi il resto
    keys = keys.filter(k => k !== this.criticalConstraintKey && k !== 'overtourism_level');
    this.kpiKeys = [];
    if (this.kpisMain['overtourism_level'] !== undefined) this.kpiKeys.push('overtourism_level');
    if (this.criticalConstraintKey && this.kpisMain[this.criticalConstraintKey] !== undefined) this.kpiKeys.push(this.criticalConstraintKey);
    this.kpiKeys.push(...keys);
  }

  // Estrae in modo sicuro il "Level" da formato v1 (numero) o v2 (oggetto {level, confidence})
  getLevel(val: any): number | null {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return val;
    if (typeof val === 'object' && 'level' in val) return val.level;
    return null;
  }

  getConfidence(val: any): number | null {
    if (val && typeof val === 'object' && val.confidence !== undefined) return val.confidence;
    return null;
  }

  getDeltaPerc(leftVal: any, rightVal: any): string {
    const left = this.getLevel(leftVal);
    const right = this.getLevel(rightVal);
    if (left === null || right === null || left === right) return '—';
    
    const delta = right - left;
    const percent = Math.round(delta);
    
    if (delta < 1 && delta > 0) return '<1%';
    if (delta > -1 && delta < 0) return '<-1%';
    return percent > 0 ? `+${percent}%` : `${percent}%`;
  }

  getDeltaClass(leftVal: any, rightVal: any): string {
    const left = this.getLevel(leftVal);
    const right = this.getLevel(rightVal);
    if (left === null || right === null) return 'btn-outline-secondary';

    const deltaPerc = right - left;
    if (Math.abs(deltaPerc) <= 2) return 'btn-outline-secondary';
    if (deltaPerc > 2) return 'btn-outline-danger';
    return 'btn-outline-success';
  }
}