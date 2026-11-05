import {
  Component, Input, OnChanges, OnDestroy,
  AfterViewInit, ViewChild, ElementRef, SimpleChanges
} from '@angular/core';
import * as L from 'leaflet';
import { ClusterLegendDefinition, ClusterValueLegend, FlowDataEnvelope } from '../../models/indici.model';
import { environment } from '../../../environments/environment';

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
  @Input() legend?: ClusterValueLegend;
  @Input() flows: FlowDataEnvelope | null = null;
  @Input() colorScaleMode: 'linear' | 'log' = 'linear';
  @Input() unitDescription: string = ''; 
  @Input() mapTitle: string = '';
  @ViewChild('mapEl', { static: false }) mapEl!: ElementRef;

  private map?: L.Map;
  private geoLayer?: L.GeoJSON;
  private flowLayer?: L.LayerGroup;
  private flowArrowMarkers: { marker: L.Marker; from: L.LatLng; to: L.LatLng }[] = [];
  private colorbarControl?: L.Control;
  private ready = false;
  private currentHoveredLayer: L.Path | null = null; 

  constructor() {}

  ngAfterViewInit(): void {
    this.map = L.map(this.mapEl.nativeElement, { zoomControl: true, attributionControl: false })
      .setView([44.3, 9], 8);
    this.map.on('zoomend', this.updateFlowArrowDirections, this);

    const apiKey = environment.cartoApiKey;
    const tileUrl = apiKey
      ? `https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png?key=${apiKey}`
      : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png';

    L.tileLayer(tileUrl, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(this.map);

    this.ready = true;
    if (this.geojsonStr) this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.ready && (changes['geojsonStr'] || changes['minValue'] || changes['maxValue'] || changes['legend'] || changes['flows'] || changes['colorScaleMode'] || changes['unitDescription'] || changes['mapTitle'])) {
      this.render();
    }
  }

  ngOnDestroy(): void {
    if (this.map) {
      this.map.remove();
    }
  }

  private render(): void {
    if (!this.map || !this.geojsonStr) return;
    this.currentHoveredLayer = null;
    // Pulisci vecchi layer e controlli
    if (this.geoLayer) { this.map.removeLayer(this.geoLayer); }
    if (this.flowLayer) { this.map.removeLayer(this.flowLayer); }
    this.flowArrowMarkers = [];
    if (this.colorbarControl) { this.map.removeControl(this.colorbarControl); }

    let geojson: any;
    try { 
      geojson = JSON.parse(this.geojsonStr); 
      geojson = this.fixEncoding(geojson);

    } catch (e) { 
      console.error('GeoJSON parse error', e); 
      return; 
    }

    const clusterLegend = this.legend?.type === 'cluster-value' ? this.legend : undefined;
    const clusterRanges = clusterLegend
      ? this.getClusterRanges(geojson, clusterLegend.cluster_property)
      : new Map<string, { min: number; max: number }>();
    const clusterDefinitions = new Map<string, ClusterLegendDefinition>();
    clusterLegend?.clusters.forEach(cluster => clusterDefinitions.set(String(cluster.id), cluster));
    
    // ── 1. Disegna i dati GeoJSON e gestisci l'Hover ───────────────────────
    this.geoLayer = L.geoJSON(geojson, {
      style: (feature: any) => {
        const val = feature?.properties?.INDICE;
        const indexValue = this.toFiniteNumber(val);
        const fillColor = indexValue === null
          ? null
          : clusterLegend
            ? this.clusterValueColor(feature, clusterLegend, clusterRanges, clusterDefinitions)
            : this.viridisColor(indexValue);
        const isNull = fillColor === null;
        return {
          fillColor:   fillColor ?? '#cccccc',
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
        
        const mainIndex = `<strong>VALORE INDICE</strong>: ${fmt}`;

        // Estrai attributi extra
        const excludedKeys = ['INDICE', 'AREA_NAME', 'COMUNE', 'COM_CODE', 'COD_COM']; 
        const extraFields = Object.entries(props)
          .filter(([k]) => !excludedKeys.includes(k.toUpperCase()))
          .map(([k, v]) => {
            const formatted = typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(2)) : v;
            return `<strong>${k}</strong>: ${formatted}`;
          })
          .join('<br>');

        // Associa il Tooltip (appare on hover)
        (layer as L.Path).bindTooltip(
          `<strong>${name}</strong><br>${mainIndex}<br>${extraFields}`,
          { sticky: true, opacity: 0.9 }
        );

        // Effetto grafico on Hover
        layer.on('mouseover', () => {
          (layer as L.Path).setStyle({ weight: 2, color: '#444', dashArray: '', fillOpacity: 1.0 });
        });
        layer.on('mouseout', () => {
          this.geoLayer?.resetStyle(layer as L.Path);
        });
        layer.on('mouseover', () => {
          // Resetta il layer rimasto bloccato (es. dopo cambio tab)
          if (this.currentHoveredLayer && this.currentHoveredLayer !== (layer as L.Path)) {
            this.geoLayer?.resetStyle(this.currentHoveredLayer);
          }
          this.currentHoveredLayer = layer as L.Path;
          (layer as L.Path).setStyle({ weight: 2, color: '#444', dashArray: '', fillOpacity: 1.0 });
        });
        layer.on('mouseout', () => {
          this.geoLayer?.resetStyle(layer as L.Path);
          this.currentHoveredLayer = null;
        });
      }
    }).addTo(this.map);
    this.map.getContainer().addEventListener('mouseleave', () => {
      if (this.currentHoveredLayer) {
        this.geoLayer?.resetStyle(this.currentHoveredLayer);
        this.currentHoveredLayer = null;
      }
    });
    // Forza ricalcolo delle dimensioni e adatta la vista
    setTimeout(() => {
      this.map!.invalidateSize();
      this.map!.fitBounds(this.geoLayer!.getBounds(), { padding: [10, 10] });
      this.renderFlows();
      this.renderColorbar(geojson); // Crea la legenda
    }, 0);
  }

  private renderFlows(): void {
    if (!this.map || !this.flows?.data?.features?.length) return;

    this.flowLayer = L.layerGroup().addTo(this.map);
    const maxValue = Number.isFinite(this.flows.max_value) && this.flows.max_value > 0
      ? this.flows.max_value
      : Math.max(...this.flows.data.features.map(feature => feature.properties.value).filter(Number.isFinite), 0);

    for (const feature of this.flows.data.features) {
      const coordinates = feature.geometry?.coordinates;
      if (feature.geometry?.type !== 'LineString' || !Array.isArray(coordinates) || coordinates.length < 2) {
        console.warn('Skipping invalid flow feature: expected a LineString with at least two coordinates.', feature);
        continue;
      }

      const latLngs = coordinates
        .filter((coordinate): coordinate is [number, number] =>
          Array.isArray(coordinate) &&
          Number.isFinite(coordinate[0]) &&
          Number.isFinite(coordinate[1])
        )
        .map(([longitude, latitude]) => L.latLng(latitude, longitude));
      if (latLngs.length < 2) {
        console.warn('Skipping invalid flow feature: it has fewer than two valid coordinates.', feature);
        continue;
      }

      const value = Number.isFinite(feature.properties.value) ? Math.max(0, feature.properties.value) : 0;
      const width = maxValue > 0 ? 1 + 2 * Math.sqrt(value / maxValue) : 1;
      const line = L.polyline(latLngs, {
        color: '#000000',
        weight: width,
        opacity: 0.8,
        lineCap: 'round',
      }).addTo(this.flowLayer);

      const { from_label, to_label } = feature.properties;
      const route = [from_label || feature.properties.from, to_label || feature.properties.to]
        .filter((label): label is string => !!label)
        .join(' → ');
      const tooltip = `${route ? `<strong>${this.escapeHtml(route)}</strong><br>` : ''}Flusso: ${value.toFixed(1)}${this.flows.unit ? ` ${this.escapeHtml(this.flows.unit)}` : ''}`;
      line.bindTooltip(tooltip, { sticky: true, opacity: 0.95 });

      const from = latLngs[0];
      const to = latLngs[latLngs.length - 1];
      const marker = L.marker(to, {
        icon: this.createFlowArrowIcon(0),
        interactive: true,
        keyboard: false,
        zIndexOffset: 1000,
      }).addTo(this.flowLayer);
      marker.bindTooltip(tooltip, { sticky: true, opacity: 0.95 });
      this.flowArrowMarkers.push({ marker, from, to });
    }

    this.updateFlowArrowDirections();
  }

  private updateFlowArrowDirections(): void {
    if (!this.map) return;

    for (const { marker, from, to } of this.flowArrowMarkers) {
      const start = this.map.latLngToLayerPoint(from);
      const end = this.map.latLngToLayerPoint(to);
      const angle = Math.atan2(end.x - start.x, start.y - end.y) * 180 / Math.PI;
      marker.setIcon(this.createFlowArrowIcon(angle));
    }
  }

  private createFlowArrowIcon(angle: number): L.DivIcon {
    return L.divIcon({
      className: 'flow-arrow-icon',
      html: `<span style="display:block;width:14px;height:14px;transform:rotate(${angle}deg);transform-origin:50% 0;"><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M7 0 13 13 7 10 1 13Z" fill="#000000"/></svg></span>`,
      iconSize: [14, 14],
      iconAnchor: [7, 1],
    });
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    })[char] || char);
  }
  private fixEncoding(obj: any): any {
    if (typeof obj === 'string') {
      try {
        // escape() mappa ogni char al suo %XX latin-1, decodeURIComponent() lo reinterpreta come UTF-8
        return decodeURIComponent(escape(obj));
      } catch {
        return obj; // Se fallisce (es. stringa già corretta) restituisce l'originale
      }
    }
    if (Array.isArray(obj)) {
      return obj.map(item => this.fixEncoding(item));
    }
    if (obj !== null && typeof obj === 'object') {
      const fixed: any = {};
      for (const key of Object.keys(obj)) {
        fixed[key] = this.fixEncoding(obj[key]);
      }
      return fixed;
    }
    return obj; // number, boolean, null: invariati
  }
  // ── 2. Scala Colori Viridis ──────────────────────────────────────────────
  private readonly STOPS: [number, [number, number, number]][] = [
    [0.0,  [173, 216, 230]],
    [0.25, [116, 185, 225]],
    [0.5,  [59,  153, 220]],
    [0.75, [25,  100, 180]],
    [1.0,  [8,   48,  107]],
  ];

  private usesLogScale(): boolean {
    if (this.colorScaleMode === 'log') return true;
    return this.minValue > 0 && this.maxValue / this.minValue >= 100;
  }

  private normalizeRange(value: number, min: number, max: number): number {
    if (max === min) return 0.5;

    if (this.usesLogScale()) {
      const shift = min <= 0 ? 1 - min : 0;
      const logMin = Math.log(min + shift);
      const logMax = Math.log(max + shift);
      const logVal = Math.log(value + shift);
      return Math.max(0, Math.min(1, (logVal - logMin) / (logMax - logMin)));
    }

    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  private normalize(value: number): number {
    return this.normalizeRange(value, this.minValue, this.maxValue);
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
    const [r, g, b] = [0, 1, 2].map(i => Math.round(lo[1][i] + f * (hi[1][i] - lo[1][i])));
    return `rgb(${r},${g},${b})`;
  }

  private getClusterRanges(
    geojson: any,
    clusterProperty: string
  ): Map<string, { min: number; max: number }> {
    const ranges = new Map<string, { min: number; max: number }>();
    const features = Array.isArray(geojson?.features) ? geojson.features : [];

    for (const feature of features) {
      const clusterId = feature?.properties?.[clusterProperty];
      const value = this.toFiniteNumber(feature?.properties?.INDICE);
      if (clusterId === null || clusterId === undefined || value === null) continue;

      const key = String(clusterId);
      const range = ranges.get(key);
      if (range) {
        range.min = Math.min(range.min, value);
        range.max = Math.max(range.max, value);
      } else {
        ranges.set(key, { min: value, max: value });
      }
    }

    return ranges;
  }

  private clusterValueColor(
    feature: any,
    legend: ClusterValueLegend,
    ranges: Map<string, { min: number; max: number }>,
    definitions: Map<string, ClusterLegendDefinition>
  ): string | null {
    const clusterId = feature?.properties?.[legend.cluster_property];
    if (clusterId === null || clusterId === undefined) return null;

    const definition = definitions.get(String(clusterId));
    const range = ranges.get(String(clusterId));
    if (!definition || !range) return null;

    const value = this.toFiniteNumber(feature?.properties?.INDICE);
    if (value === null) return null;

    const fraction = this.normalizeRange(value, range.min, range.max);
    return this.shadeClusterColor(definition.color, fraction);
  }

  private shadeClusterColor(baseColor: string, fraction: number): string | null {
    const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(baseColor);
    if (!match) {
      console.error(`Invalid cluster legend color: ${baseColor}`);
      return null;
    }

    const hex = match[1].length === 3
      ? match[1].split('').map(char => char + char).join('')
      : match[1];
    const strength = 0.25 + 0.75 * fraction;
    const channels = [0, 2, 4].map(offset => {
      const base = parseInt(hex.slice(offset, offset + 2), 16);
      return Math.round(255 + (base - 255) * strength);
    });
    return `rgb(${channels[0]},${channels[1]},${channels[2]})`;
  }

  private toFiniteNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  // ── 3. Legenda (Colorbar) ────────────────────────────────────────────────
  private renderColorbar(geojson: any): void {
    if (!this.map) return;
    if (this.legend?.type === 'cluster-value') {
      this.renderClusterLegend(this.legend, geojson);
      return;
    }

    const BAR_H = 200, BAR_W = 18;
    const self = this;

    const ColorbarControl = L.Control.extend({
      onAdd(): HTMLElement {
        const div = L.DomUtil.create('div');
        div.style.cssText = `
          background: white; border-radius: 4px; padding: 10px 14px 10px 10px;
          box-shadow: 0 1px 5px rgba(0,0,0,0.3); font-family: Arial, sans-serif;
          font-size: 12px; display: flex; flex-direction: column;
          align-items: flex-start; gap: 4px;`;

          const title = document.createElement('div');
          title.textContent = `Legenda${self.usesLogScale() ? ' (log)' : ''}`;
          title.style.cssText = 'font-weight: bold; margin-bottom: 4px; max-width: 200px; line-height: 1.2;';
          div.appendChild(title);

        const row = document.createElement('div');
        row.style.cssText = 'display: flex; flex-direction: row; align-items: stretch; gap: 6px;';

        if (self.unitDescription) {
          const unit = document.createElement('div');
          unit.textContent = self.unitDescription;
          unit.style.cssText = 'font-size: 10px; color: #555; margin-bottom: 6px; max-width: 130px; line-height: 1.2;';
          div.appendChild(unit);
        }

        const canvas = document.createElement('canvas');
        canvas.width = BAR_W; canvas.height = BAR_H;
        const ctx = canvas.getContext('2d')!;
        for (let y = 0; y < BAR_H; y++) {
          const fraction = y / BAR_H;
          let val: number;
          if (self.usesLogScale()) {
            const shift  = self.minValue <= 0 ? 1 - self.minValue : 0;
            const logMin = Math.log(self.minValue + shift);
            const logMax = Math.log(self.maxValue + shift);
            val = Math.exp(logMax - fraction * (logMax - logMin)) - shift;
          } else {
            val = self.maxValue - fraction * (self.maxValue - self.minValue);
          }
          ctx.fillStyle = self.viridisColor(val);
          ctx.fillRect(0, y, BAR_W, 1);
        }
        row.appendChild(canvas);

        const ticks = document.createElement('div');
        ticks.style.cssText = `display: flex; flex-direction: column; justify-content: space-between; height: ${BAR_H}px;`;
        
        const steps = 5;
        for (let i = 0; i <= steps; i++) {
          let val: number;
          if (self.usesLogScale()) {
            const shift  = self.minValue <= 0 ? 1 - self.minValue : 0;
            const logMin = Math.log(self.minValue + shift);
            const logMax = Math.log(self.maxValue + shift);
            val = Math.exp(logMax - (i / steps) * (logMax - logMin)) - shift;
          } else {
            val = self.maxValue - (i / steps) * (self.maxValue - self.minValue);
          }
          const span = document.createElement('span');
          span.textContent = val.toFixed(1);
          span.style.cssText = 'line-height: 1; font-size: 11px; color: #333;';
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

  private renderClusterLegend(legend: ClusterValueLegend, geojson: any): void {
    if (!this.map) return;

    const ranges = this.getClusterRanges(geojson, legend.cluster_property);
    const self = this;
    const ClusterLegendControl = L.Control.extend({
      onAdd(): HTMLElement {
        const div = L.DomUtil.create('div');
        div.style.cssText = `
          background: white; border-radius: 4px; padding: 10px;
          box-shadow: 0 1px 5px rgba(0,0,0,0.3); font-family: Arial, sans-serif;
          font-size: 12px; display: flex; flex-direction: column; gap: 7px;
          max-height: 260px; overflow-y: auto;`;
        L.DomEvent.disableClickPropagation(div);

        const title = document.createElement('div');
        title.textContent = `Legenda${self.usesLogScale() ? ' (log)' : ''}`;
        title.style.cssText = 'font-weight: bold; line-height: 1.2;';
        div.appendChild(title);

        if (self.unitDescription) {
          const unit = document.createElement('div');
          unit.textContent = self.unitDescription;
          unit.style.cssText = 'font-size: 10px; color: #555; line-height: 1.2;';
          div.appendChild(unit);
        }

        for (const cluster of legend.clusters) {
          const section = document.createElement('div');
          section.style.cssText = 'display: flex; flex-direction: column; gap: 3px;';

          const label = document.createElement('div');
          label.textContent = cluster.label || String(cluster.id);
          label.style.cssText = 'font-weight: 600; max-width: 180px; line-height: 1.2;';
          section.appendChild(label);

          const row = document.createElement('div');
          row.style.cssText = 'display: flex; align-items: stretch; gap: 5px; height: 42px;';

          const swatch = document.createElement('div');
          const range = ranges.get(String(cluster.id));
          const middleColor = self.shadeClusterColor(cluster.color, 0.5);
          const gradient = range
            ? Array.from({ length: 11 }, (_, i) => {
                const fraction = i / 10;
                const value = range.min + fraction * (range.max - range.min);
                const shade = self.shadeClusterColor(
                  cluster.color,
                  self.normalizeRange(value, range.min, range.max)
                ) || '#cccccc';
                return `${shade} ${fraction * 100}%`;
              }).join(', ')
            : '#cccccc, #cccccc';
          swatch.style.cssText = `width: 14px; border: 1px solid #ddd; background: ${
            range?.min === range?.max
              ? middleColor || '#cccccc'
              : `linear-gradient(to top, ${gradient})`
          };`;
          row.appendChild(swatch);

          const ticks = document.createElement('div');
          ticks.style.cssText = 'display: flex; flex-direction: column; justify-content: space-between; line-height: 1; font-size: 10px; color: #333;';
          const max = document.createElement('span');
          max.textContent = range ? range.max.toFixed(2) : 'N/A';
          const min = document.createElement('span');
          min.textContent = range ? range.min.toFixed(2) : 'N/A';
          ticks.append(max, min);
          row.appendChild(ticks);
          section.appendChild(row);
          div.appendChild(section);
        }

        return div;
      }
    });

    this.colorbarControl = new ClusterLegendControl({ position: 'topright' });
    this.colorbarControl.addTo(this.map);
  }
}