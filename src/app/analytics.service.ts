import { Injectable } from '@angular/core';
import {ANALYTICS_ENABLED_LOCAL_STORAGE_KEY} from './constants';

declare interface WindowWithAnalytics {
  gtag: (...args: any) => {};
}

declare const window: WindowWithAnalytics;

@Injectable({
  providedIn: 'root'
})
export class AnalyticsService {

  enabled = false;

  constructor() {
    this.enabled = localStorage.getItem(ANALYTICS_ENABLED_LOCAL_STORAGE_KEY) === 'true';
  }

  recordEvent(eventName: string, eventParams?: {}) {
    try {
      if (this.enabled) {
        window.gtag('event', eventName, eventParams);
      }
    } catch (e) {}
  }
}
