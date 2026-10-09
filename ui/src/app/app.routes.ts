import { Routes } from '@angular/router';
import { FmeaEntryDetailComponent } from './fmea-entry-detail/fmea-entry-detail.component';
import { FmeaPageComponent } from './fmea-page/fmea-page.component';
import { FmeaInfoPageComponent } from './fmea-info-page/fmea-info-page.component';
import { FmeaEntryCreatePageComponent } from './fmea-entry-create-page/fmea-entry-create-page.component';
import { ActionItemsPageComponent } from './action-items-page/action-items-page.component';

export const routes: Routes = [
  { path: 'action-items', component: ActionItemsPageComponent },
  { path: 'about-fmea', component: FmeaInfoPageComponent },
  { path: 'fmea/new', component: FmeaEntryCreatePageComponent },
  { path: 'fmea/:fmeaEntryId', component: FmeaEntryDetailComponent },
  { path: 'fmea', component: FmeaPageComponent },
  { path: '', redirectTo: 'fmea', pathMatch: 'full' },
  { path: '**', redirectTo: 'fmea' },
];
