import { Component, Input } from '@angular/core';
import { KPIs } from '../../../models/plot.model';
@Component({
  selector: 'app-kpi-box',
  standalone: false,
  templateUrl: './kpi-box.component.html',
  styleUrl: './kpi-box.component.scss'
})
export class KpiBoxComponent {
  @Input() kpisData?: KPIs;

  formatNumber(value: number | { level?: number; confidence?: number } | undefined): string {
    if (value == null) return '-';
  
    let level: number | undefined;
    let confidence: number | undefined;
  
    if (typeof value === 'number') {
      level = value;
    } else if (typeof value === 'object') {
      level = value.level;
      confidence = value.confidence;
    }
  
    if (typeof level !== 'number' || isNaN(level)) return '-';
  
    const main = level.toFixed(1);
    const conf = confidence ? ` ± ${confidence.toFixed(1)}` : '';
  
    return `${main}${conf} %`;
  }
  getKpiLevel(key: string): number | null {
    const value = this.kpisData?.[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'object' && value && 'level' in value) return value.level;
    return null;
  }
  
  getKpiConfidence(key: string): number | null {
    const value = this.kpisData?.[key];
    if (typeof value === 'object' && value && 'confidence' in value) return value.confidence ?? null;
    return null;
  }
  getKpiValue(key: string): number {
    const value = this.kpisData?.[key];
    if (typeof value === 'number') return value;
    if (typeof value === 'object' && value !== null && 'level' in value) return value.level;
    return 0;
  }
  
  kpiKeys: string[] = [];
  kpiLabels: { [key: string]: string } = {};
  criticalConstraintKey: string | null = null;

  ngOnChanges() {
    if (this.kpisData) {
      const excluded = ['critical constraint', 'uncertainty', 'uncertainty_by_constraint'];

      this.kpiKeys = Object.keys(this.kpisData)
      .filter(key => !excluded.includes(key));
      this.kpiLabels = {};
      this.kpiKeys.forEach(key => {
        this.kpiLabels[key] = 'kpi.' + key.replace(/ /g, '_');
      });
    }
    const cc = this.kpisData?.['critical_constraint'];
let dynamicKey: string | null = null;
if (
  cc &&
  typeof cc === 'object' &&
  'name' in cc &&
  'level' in cc
) {
  dynamicKey = `constraint_level_${cc.name}`;
  this.criticalConstraintKey = dynamicKey;
} else {
  this.criticalConstraintKey = null;
}

let keys = this.kpiKeys.filter(k => k !== dynamicKey && k !== 'sustainability_level');

this.kpiKeys = [];

if (this.kpisData && 'sustainability_level' in this.kpisData) {
  this.kpiKeys.push('sustainability_level');
}

if (dynamicKey) {
  this.kpiKeys.push(dynamicKey);
}

this.kpiKeys.push(...keys);

  }
  
  // getKpiValue(key: string): number {
  //   const value = this.kpisData?.[key];
  //   return typeof value === 'number' ? value : 0;
  // }
  getKpiRawValue(key: string): number | { level: number } | undefined {
    return this.kpisData?.[key];
  }
  get criticalConstraint() {
    const value = this.kpisData?.['critical constraint'];
    if (
      value &&
      typeof value === 'object' &&
      'name' in value &&
      'level' in value
    ) {
      return value as { name: string; level: number };
    }
    return null;
  }
  getKpiClass(value: number | { level: number } | undefined): string {
    const level = typeof value === 'number' 
      ? value 
      : typeof value === 'object' && value !== null && 'level' in value 
        ? value.level 
        : 0;
  
    if (level < 10) return 'kpi-box green';
    if (level < 30) return 'kpi-box yellow';
    return 'kpi-box red';
  }
}
