import { Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { BannerComponent } from './banner/banner.component';
import { FmeaSelectionService } from './services/fmea-selection.service';
import { NavigationHistoryService } from './services/navigation-history.service';

@Component({
  imports: [BannerComponent, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly router = inject(Router);
  readonly navigationHistory = inject(NavigationHistoryService);

  constructor(private readonly fmeaSelection: FmeaSelectionService) {}

  get isAboutFmeaPage(): boolean {
    return this.router.url.split(/[?#]/, 1)[0] === '/about-fmea';
  }

  onTeamChange(teamId: string): void {
    this.fmeaSelection.selectTeam(teamId);
  }

  onSeasonChange(seasonId: string): void {
    this.fmeaSelection.selectSeason(seasonId);
  }
}
