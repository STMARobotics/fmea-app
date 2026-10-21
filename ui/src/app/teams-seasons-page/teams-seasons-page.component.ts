import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { Season, SeasonService } from '../services/season.service';
import { Team, TeamService } from '../services/team.service';

@Component({
  imports: [ReactiveFormsModule],
  selector: 'app-teams-seasons-page',
  styleUrl: './teams-seasons-page.component.scss',
  templateUrl: './teams-seasons-page.component.html',
})
export class TeamsSeasonsPageComponent implements OnInit {
  private readonly formBuilder = inject(FormBuilder);
  private readonly teamService = inject(TeamService);
  private readonly seasonService = inject(SeasonService);

  readonly teams = signal<Team[]>([]);
  readonly seasons = signal<Season[]>([]);
  readonly editingTeamId = signal<string | null>(null);
  readonly editingSeasonId = signal<string | null>(null);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);

  readonly teamForm = this.formBuilder.nonNullable.group({
    program: this.formBuilder.nonNullable.control<Team['program']>('frc'),
    teamNumber: this.formBuilder.nonNullable.control(1, [
      Validators.required,
      Validators.min(1),
      Validators.pattern(/^[1-9]\d*$/),
    ]),
    name: ['', [Validators.required, Validators.pattern(/\S/)]],
  });

  readonly seasonForm = this.formBuilder.nonNullable.group({
    program: this.formBuilder.nonNullable.control<Season['program']>('frc'),
    name: ['', [Validators.required, Validators.pattern(/\S/)]],
  });

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set(null);
    try {
      const [teams, seasons] = await Promise.all([
        firstValueFrom(this.teamService.getAllTeams()),
        firstValueFrom(this.seasonService.getAllSeasons()),
      ]);
      this.teams.set(this.sortTeams(teams));
      this.seasons.set(this.sortSeasons(seasons));
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'Unable to load teams and seasons.'));
    } finally {
      this.loading.set(false);
    }
  }

  editTeam(team: Team): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.editingTeamId.set(team.id);
    this.teamForm.setValue({
      program: team.program,
      teamNumber: team.num,
      name: team.name,
    });
  }

  cancelTeamEdit(): void {
    this.editingTeamId.set(null);
    this.teamForm.reset({ program: 'frc', teamNumber: 1, name: '' });
  }

  async saveTeam(): Promise<void> {
    if (this.teamForm.invalid || this.saving()) {
      this.teamForm.markAllAsTouched();
      return;
    }
    const formValue = this.teamForm.getRawValue();
    this.saving.set(true);
    this.clearMessages();
    try {
      const editingId = this.editingTeamId();
      const team = editingId
        ? await firstValueFrom(this.teamService.updateTeam(editingId, {
            program: formValue.program,
            teamNumber: formValue.teamNumber,
            name: formValue.name.trim(),
          }))
        : await firstValueFrom(this.teamService.createTeam({
            program: formValue.program,
            teamNumber: formValue.teamNumber,
            name: formValue.name.trim(),
          }));
      this.teams.update(teams => this.sortTeams([
        ...teams.filter(existing => existing.id !== team.id),
        team,
      ]));
      this.successMessage.set(editingId ? 'Team updated.' : 'Team created.');
      this.cancelTeamEdit();
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'Unable to save team.'));
    } finally {
      this.saving.set(false);
    }
  }

  editSeason(season: Season): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
    this.editingSeasonId.set(season.id);
    this.seasonForm.setValue({ program: season.program, name: season.name });
  }

  cancelSeasonEdit(): void {
    this.editingSeasonId.set(null);
    this.seasonForm.reset({ program: 'frc', name: '' });
  }

  async saveSeason(): Promise<void> {
    if (this.seasonForm.invalid || this.saving()) {
      this.seasonForm.markAllAsTouched();
      return;
    }
    const formValue = this.seasonForm.getRawValue();
    this.saving.set(true);
    this.clearMessages();
    try {
      const editingId = this.editingSeasonId();
      const season = editingId
        ? await firstValueFrom(this.seasonService.updateSeason(editingId, {
            program: formValue.program,
            name: formValue.name.trim(),
          }))
        : await firstValueFrom(this.seasonService.createSeason({
            program: formValue.program,
            name: formValue.name.trim(),
          }));
      this.seasons.update(seasons => this.sortSeasons([
        ...seasons.filter(existing => existing.id !== season.id),
        season,
      ]));
      this.successMessage.set(editingId ? 'Season updated.' : 'Season created.');
      this.cancelSeasonEdit();
    } catch (error) {
      this.errorMessage.set(this.errorText(error, 'Unable to save season.'));
    } finally {
      this.saving.set(false);
    }
  }

  private clearMessages(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  private sortTeams(teams: Team[]): Team[] {
    return [...teams].sort((left, right) =>
      left.program.localeCompare(right.program) || left.num - right.num,
    );
  }

  private sortSeasons(seasons: Season[]): Season[] {
    return [...seasons].sort((left, right) =>
      left.program.localeCompare(right.program) || left.name.localeCompare(right.name),
    );
  }

  private errorText(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
  }
}
