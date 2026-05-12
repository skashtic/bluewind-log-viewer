import { Component } from '@angular/core';
import { LogsPageComponent } from './logs/logs-page.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [LogsPageComponent],
  template: '<app-logs-page />',
})
export class App {}
