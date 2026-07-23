import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  IndicatorMeta, Comune,
  IndexDataResponse, VariationDataResponse, VariationOverTimeResponse
} from '../models/indici.model';

@Injectable({ providedIn: 'root' })
export class IndiciService {

  //prefisso
  private readonly base = `${environment.apiBaseUrl}/indexes`;

  constructor(private http: HttpClient) {}

  getIndicatorList(): Observable<{ indicators: IndicatorMeta[] }> {
    return this.http.get<{ indicators: IndicatorMeta[] }>(`${this.base}/get-index-list`);
  }

  getComuni(spatialGranularity = 'comune'): Observable<{ comuni: Comune[] }> {
    const params = new HttpParams().set('spatial_granularity', spatialGranularity);
    return this.http.get<{ comuni: Comune[] }>(`${this.base}/get-comuni`, { params });
  }

  getIndexData(
    index: string,
    startDate?: string,
    endDate?: string,
    seasonality?: string,
    spatialGranularity = 'comune'
  ): Observable<IndexDataResponse> {
    let params = new HttpParams()
      .set('index', index)
      .set('spatial_granularity', spatialGranularity);
    if (startDate) params = params.set('start_date', startDate);
    if (endDate) params = params.set('end_date', endDate);
    if (seasonality) params = params.set('seasonality', seasonality);
    return this.http.get<IndexDataResponse>(`${this.base}/get_index_data`, { params });
  }

  getVariationData(
    index: string,
    startDate: string,
    endDate: string,
    granularity: string,
    spatialGranularity = 'comune'
  ): Observable<VariationDataResponse> {
    const params = new HttpParams()
      .set('index', index)
      .set('start_date', startDate)
      .set('end_date', endDate)
      .set('granularity', granularity)
      .set('spatial_granularity', spatialGranularity);
    return this.http.get<VariationDataResponse>(`${this.base}/get-variation-data`, { params });
  }

  getVariationOverTime(
    index: string,
    startBaseline: string,
    endBaseline: string,
    startComparison: string,
    endComparison: string,
    spatialGranularity = 'comune',
    seasonality?: string
  ): Observable<VariationOverTimeResponse> {
    let params = new HttpParams()
      .set('index', index)
      .set('start_date_baseline', startBaseline)
      .set('end_date_baseline', endBaseline)
      .set('start_date_comparison', startComparison)
      .set('end_date_comparison', endComparison)
      .set('spatial_granularity', spatialGranularity);
    if (seasonality) params = params.set('seasonality', seasonality);
    return this.http.get<VariationOverTimeResponse>(`${this.base}/get-variation-over-time`, { params });
  }
}