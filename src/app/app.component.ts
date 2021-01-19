import {Component, HostBinding} from '@angular/core';
import {SettingsService, Theme} from './settings.service';

interface ExpandedWindow {
  dataLayer: any[];
}

declare const window: ExpandedWindow;

@Component({
  selector: 'cn-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'Connected Notes';

  @HostBinding('class.dark-theme') darkTheme = false;

  constructor(private readonly settingsService: SettingsService) {
    window.dataLayer = window.dataLayer || [];
    const gtag = (...args: any[]) => window.dataLayer.push(args);
    gtag('js', new Date());

    gtag('config', 'G-HMG4J1GHEX');
    gtag('consent', 'default', {
      'ad_storage': 'denied',
      // Deny by default, update after consent
      'analytics_storage': 'denied'
    });

    this.settingsService.themeSetting.subscribe(newTheme => {
      if (newTheme === Theme.DARK) {
        document.body.classList.remove('light-theme');
        document.body.classList.add('dark-theme');
      } else if (newTheme === Theme.LIGHT) {
        document.body.classList.add('light-theme');
        document.body.classList.remove('dark-theme');
      }
    });
  }
}
