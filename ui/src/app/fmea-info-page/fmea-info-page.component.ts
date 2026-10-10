import { Component } from '@angular/core';
import { NavigationHistoryService } from '../services/navigation-history.service';

@Component({
  selector: 'app-fmea-info-page',
  styleUrl: './fmea-info-page.component.scss',
  templateUrl: './fmea-info-page.component.html',
})
export class FmeaInfoPageComponent {
  constructor(private readonly navigationHistory: NavigationHistoryService) {}

  goBack(): void {
    this.navigationHistory.navigateBack('/fmea');
  }
}
