import { Component, ElementRef, inject, ViewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { GoogleAuthService } from './google-auth.service';

@Component({
  selector: 'app-auth-control',
  imports: [MatButtonModule, MatMenuModule],
  styleUrl: './auth-control.component.scss',
  templateUrl: './auth-control.component.html',
})
export class AuthControlComponent {
  readonly auth = inject(GoogleAuthService);

  @ViewChild('googleSignInButton')
  set googleSignInButton(element: ElementRef<HTMLDivElement> | undefined) {
    if (element) {
      void this.auth.renderSignInButton(element.nativeElement);
    }
  }
}