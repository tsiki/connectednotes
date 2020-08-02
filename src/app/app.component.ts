import {Component, HostBinding} from '@angular/core';
import {SettingsService, Theme} from './settings.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'Connected Notes';

  @HostBinding('class.dark-theme') darkTheme = false;

  constructor(private readonly settingsService: SettingsService) {
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
