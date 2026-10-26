import { Component, Input, OnChanges } from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { DesignAngularKitModule } from 'design-angular-kit';
import { getKpiLabel, isPercentageKpi, stripSystemKpis, normalizeKpiKey } from '../../../utils/kpi.utils';

@Component({
  selector: 'app-shared-kpis',
  standalone: true,  
  imports: [CommonModule, TranslateModule, DesignAngularKitModule],
  providers: [DecimalPipe],
  templateUrl: './shared-kpis.component.html',
  styleUrls: ['./shared-kpis.component.scss']
})
export class SharedKpisComponent implements OnChanges {
  @Input() kpisMain: any = null;     
  @Input() kpisCompare?: any = null; 
  @Input() kpiMapper: Record<string, string> = {};
  kpiKeys: string[] = [];
  criticalConstraintKey: string | null = null;

  constructor(private decimalPipe: DecimalPipe) {}

  get isComparison(): boolean {
    return !!this.kpisCompare;
  }

  ngOnChanges() {
    if (!this.kpisMain) return;

    // Pulisce chiavi di sistema
    const cleanKpis = stripSystemKpis(this.kpisMain);
    
    // Deduplica le chiavi normalizzandole (se sono presenti sia con spazio che con underscore)
    const seen = new Set<string>();
    const uniqueKeys: string[] = [];
    for (const k of Object.keys(cleanKpis)) {
      const norm = normalizeKpiKey(k);
      if (!seen.has(norm)) {
        seen.add(norm);
        uniqueKeys.push(k);
      }
    }

    // Trova eventuale vincolo critico
    const cc = this.kpisMain['critical_constraint'] || this.kpisMain['critical constraint'];
    this.criticalConstraintKey = null;

    if (cc && typeof cc === 'object' && cc.name) {
      const ccName = String(cc.name).toLowerCase().trim();
      this.criticalConstraintKey = uniqueKeys.find(k => {
        const norm = normalizeKpiKey(k);
        return norm === `constraint level ${ccName}` || norm === ccName;
      }) || null;
    }

    // Ordina le chiavi
    const sustainabilityKey = uniqueKeys.find(k => normalizeKpiKey(k) === 'sustainability level');
    let remainingKeys = uniqueKeys.filter(k => k !== this.criticalConstraintKey && k !== sustainabilityKey);

    const constraints: string[] = [];
    const dropoutsAndOthers: string[] = [];

    remainingKeys.forEach(k => {
      if (k.toLowerCase().includes('dropout')) {
        dropoutsAndOthers.push(k);
      } else {
        constraints.push(k);
      }
    });

    this.kpiKeys = [];
    if (sustainabilityKey && cleanKpis[sustainabilityKey] !== undefined) {
      this.kpiKeys.push(sustainabilityKey);
    }
    if (this.criticalConstraintKey && cleanKpis[this.criticalConstraintKey] !== undefined) {
      this.kpiKeys.push(this.criticalConstraintKey);
    }
    this.kpiKeys.push(...constraints, ...dropoutsAndOthers);
  }

  isPercentage(key: string): boolean {
    return isPercentageKpi(key);
  }

  getUnit(key: string): string {
    return this.isPercentage(key) ? '%' : '';
  }

  isDropout(key: string): boolean {
    return key.toLowerCase().includes('dropout');
  }

  getLevel(val: any): number | null {
    if (val === null || val === undefined) return null;
    if (typeof val === 'number') return isNaN(val) ? null : val;
    if (typeof val === 'object') {
      if ('level' in val && typeof val.level === 'number') return val.level;
      if ('value' in val && typeof val.value === 'number') return val.value;
    }
    return null;
  }

  getConfidence(val: any): number | null {
    if (val && typeof val === 'object' && val.confidence !== undefined && val.confidence !== null) {
      return val.confidence;
    }
    return null;
  }

  getShare(val: any): number | null {
    if (val && typeof val === 'object' && val.share !== undefined && val.share !== null) {
      return val.share <= 1 ? val.share * 100 : val.share;
    }
    return null;
  }

  /**
   * Restituisce la stringa formattata: "{value} ({share}%)" per i dropout,
   * oppure solo il numero formattato per gli altri.
   */
  getDisplayValue(key: string, val: any): string {
    const level = this.getLevel(val);
    if (level === null) return '—';

    const formattedLevel = this.decimalPipe.transform(level, '1.1-1') ?? String(level);

    if (this.isDropout(key)) {
      const share = this.getShare(val);
      if (share !== null) {
        const formattedShare = this.decimalPipe.transform(share, '1.1-1') ?? String(share);
        return `${formattedLevel} (${formattedShare}%)`;
      }
      return formattedLevel;
    }

    return `${formattedLevel}${this.getUnit(key)}`;
  }

  getDeltaPerc(key: string, leftVal: any, rightVal: any): string {
    const left = this.getLevel(leftVal);
    const right = this.getLevel(rightVal);
    if (left === null || right === null || left === right) return '—';
    
    const delta = right - left;
    const isPerc = this.isPercentage(key);

    if (isPerc) {
      const rounded = Math.round(delta);
      if (delta < 1 && delta > 0) return '<1%';
      if (delta > -1 && delta < 0) return '<-1%';
      return rounded > 0 ? `+${rounded}%` : `${rounded}%`;
    }

    const roundedVal = Math.round(delta);
    return roundedVal > 0 ? `+${roundedVal}` : `${roundedVal}`;
  }

  getDeltaClass(key: string, leftVal: any, rightVal: any): string {
    const left = this.getLevel(leftVal);
    const right = this.getLevel(rightVal);
    if (left === null || right === null) return 'btn-outline-secondary';

    const delta = right - left;
    if (Math.abs(delta) <= (this.isPercentage(key) ? 2 : 5)) return 'btn-outline-secondary';
    
    return delta > 0 ? 'btn-outline-success' : 'btn-outline-danger';
  }

  getKpiLabel(key: string): string {
    return getKpiLabel(key, this.kpiMapper);
  }
}