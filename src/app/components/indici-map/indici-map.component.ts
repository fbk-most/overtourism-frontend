import {
    Component, Input, OnChanges, OnDestroy,
    AfterViewInit, ViewChild, ElementRef, SimpleChanges
  } from '@angular/core';
import * as L from 'leaflet';
  
  @Component({
    selector: 'app-indici-map',
    templateUrl: './indici-map.component.html',
    styleUrls: ['./indici-map.component.scss'],
    standalone: false
  })
  export class IndiciMapComponent implements AfterViewInit, OnChanges, OnDestroy {
    @Input() geojsonStr: string | null = null;
    @Input() minValue = 0;
    @Input() maxValue = 10;
    @Input() colorScaleMode: 'linear' | 'log' = 'linear';
  
    @ViewChild('mapEl', { static: false }) mapEl!: ElementRef;
  
    private map?: L.Map;
    private geoLayer?: L.GeoJSON;
    private colorbarControl?: L.Control;
    private ready = false;
  
    ngAfterViewInit(): void {
      this.map = L.map(this.mapEl.nativeElement, { zoomControl: true, attributionControl: false })
        .setView([44.3, 9], 8);
      this.ready = true;
      if (this.geojsonStr) this.render();
    }
  
    ngOnChanges(changes: SimpleChanges): void {
      if (this.ready && (changes['geojsonStr'] || changes['minValue'] || changes['maxValue'] || changes['colorScaleMode'])) {
        this.render();
      }
    }
  
    ngOnDestroy(): void {
      this.map?.remove();
    }
  
    private render(): void {
      if (!this.map || !this.geojsonStr) return;
  
      if (this.geoLayer) { this.map.removeLayer(this.geoLayer); }
      if (this.colorbarControl) { this.map.removeControl(this.colorbarControl); }
  
      let geojson: any;
      try { geojson = JSON.parse(this.geojsonStr); }
      catch (e) { console.error('GeoJSON parse error', e); return; }
  
      this.geoLayer = L.geoJSON(geojson, {
        style: (feature: any) => {
          const val = feature?.properties?.INDICE;
          const isNull = val === null || val === undefined;
          return {
            fillColor:   isNull ? '#cccccc' : this.viridisColor(val),
            weight:      1,
            opacity:     1,
            color:       'white',
            dashArray:   isNull ? '4' : '3',
            fillOpacity: isNull ? 0.4 : 0.8,
          };
        },
        onEachFeature: (feature: any, layer: L.Layer) => {
          const props = feature.properties;
          const name  = props.AREA_NAME || 'N/A';
          const val   = props.INDICE;
          const fmt   = val === null || val === undefined ? 'N/A' : (+val).toFixed(2);
  
          const extras = Object.entries(props)
            .filter(([k]) => !k.toUpperCase().includes('COM') && !['INDICE', 'AREA_NAME'].includes(k))
            .map(([k, v]) => `<strong>${k}</strong>: ${typeof v === 'number' ? (+v).toFixed(2) : v}`)
            .join('<br>');
  
          (layer as L.Path).bindTooltip(
            `<strong>${name}</strong><br><strong>INDICE</strong>: ${fmt}<br>${extras}`,
            { sticky: true, opacity: 0.9 }
          );
  
          (layer as L.Path).on('mouseover', () =>
            (layer as L.Path).setStyle({ weight: 2, color: '#444', fillOpacity: 1 }));
          (layer as L.Path).on('mouseout', () =>
            this.geoLayer?.resetStyle(layer as L.Path));
        }
      }).addTo(this.map);
      setTimeout(() => {
        this.map!.invalidateSize();
        this.map!.fitBounds(this.geoLayer!.getBounds(), { padding: [10, 10] });
        this.renderColorbar();
      }, 0);
    }
  
    // ── Viridis colorscale ──────────────────────────────────────────────────
  
    private readonly STOPS: [number, [number, number, number]][] = [
      [0.0,  [173, 216, 230]],
      [0.25, [116, 185, 225]],
      [0.5,  [59,  153, 220]],
      [0.75, [25,  100, 180]],
      [1.0,  [8,   48,  107]],
    ];
  
    private normalize(value: number): number {
      if (this.colorScaleMode === 'log') {
        const shift  = this.minValue <= 0 ? 1 - this.minValue : 0;
        const logMin = Math.log(this.minValue + shift);
        const logMax = Math.log(this.maxValue + shift);
        const logVal = Math.log(value + shift);
        return Math.max(0, Math.min(1, (logVal - logMin) / (logMax - logMin)));
      }
      return Math.max(0, Math.min(1, (value - this.minValue) / (this.maxValue - this.minValue)));
    }
  
    private viridisColor(value: number): string {
      const t = this.normalize(value);
      let lo = this.STOPS[0], hi = this.STOPS[this.STOPS.length - 1];
      for (let i = 0; i < this.STOPS.length - 1; i++) {
        if (t >= this.STOPS[i][0] && t <= this.STOPS[i + 1][0]) {
          lo = this.STOPS[i]; hi = this.STOPS[i + 1]; break;
        }
      }
      const f = hi[0] === lo[0] ? 0 : (t - lo[0]) / (hi[0] - lo[0]);
      const [r, g, b] = [0, 1, 2].map(i =>
        Math.round(lo[1][i] + f * (hi[1][i] - lo[1][i])));
      return `rgb(${r},${g},${b})`;
    }
  
    private renderColorbar(): void {
      if (!this.map) return;
      if (this.colorbarControl) { this.map.removeControl(this.colorbarControl); }
  
      const BAR_H = 180, BAR_W = 16;
      const self = this;
  
      const ColorbarControl = L.Control.extend({
        onAdd(): HTMLElement {
          const div = L.DomUtil.create('div');
          div.style.cssText = 'background:white;border-radius:4px;padding:10px 12px;box-shadow:0 1px 5px rgba(0,0,0,.3);font-size:12px;display:flex;flex-direction:column;gap:4px;';
  
          const title = document.createElement('div');
          title.textContent = `Legenda${self.colorScaleMode === 'log' ? ' (log)' : ''}`;
          title.style.fontWeight = 'bold';
          div.appendChild(title);
  
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;flex-direction:row;align-items:stretch;gap:6px;';
  
          const canvas = document.createElement('canvas');
          canvas.width = BAR_W; canvas.height = BAR_H;
          const ctx = canvas.getContext('2d')!;
          for (let y = 0; y < BAR_H; y++) {
            const frac = y / BAR_H;
            let val: number;
            if (self.colorScaleMode === 'log') {
              const shift  = self.minValue <= 0 ? 1 - self.minValue : 0;
              const logMin = Math.log(self.minValue + shift);
              const logMax = Math.log(self.maxValue + shift);
              val = Math.exp(logMax - frac * (logMax - logMin)) - shift;
            } else {
              val = self.maxValue - frac * (self.maxValue - self.minValue);
            }
            ctx.fillStyle = self.viridisColor(val);
            ctx.fillRect(0, y, BAR_W, 1);
          }
          row.appendChild(canvas);
  
          const ticks = document.createElement('div');
          ticks.style.cssText = `display:flex;flex-direction:column;justify-content:space-between;height:${BAR_H}px;`;
          for (let i = 0; i <= 5; i++) {
            let val: number;
            if (self.colorScaleMode === 'log') {
              const shift  = self.minValue <= 0 ? 1 - self.minValue : 0;
              const logMin = Math.log(self.minValue + shift);
              const logMax = Math.log(self.maxValue + shift);
              val = Math.exp(logMax - (i / 5) * (logMax - logMin)) - shift;
            } else {
              val = self.maxValue - (i / 5) * (self.maxValue - self.minValue);
            }
            const span = document.createElement('span');
            span.textContent = val.toFixed(1);
            span.style.cssText = 'font-size:11px;color:#333;line-height:1;';
            ticks.appendChild(span);
          }
          row.appendChild(ticks);
          div.appendChild(row);
          return div;
        }
      });
  
      this.colorbarControl = new ColorbarControl({ position: 'topright' });
      this.colorbarControl.addTo(this.map);
    }
  }