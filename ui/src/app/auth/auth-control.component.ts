import { Component, inject, OnInit } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { GoogleAuthService } from './google-auth.service';

@Component({
  selector: 'app-auth-control',
  imports: [MatButtonModule, MatMenuModule],
  styleUrl: './auth-control.component.scss',
  templateUrl: './auth-control.component.html',
})
export class AuthControlComponent implements OnInit {
  readonly auth = inject(GoogleAuthService);

  ngOnInit(): void {
    void this.auth.restoreSession();
  }
}