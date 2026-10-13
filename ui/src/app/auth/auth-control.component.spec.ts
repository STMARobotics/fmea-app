import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { AuthControlComponent } from './auth-control.component';
import { GoogleAuthService } from './google-auth.service';

describe('AuthControlComponent', () => {
  let fixture: ComponentFixture<AuthControlComponent>;
  const auth = {
    user: signal<{ sub: string; email: string; name: string; picture: string } | null>(null),
    renderSignInButton: vi.fn(),
    signOut: vi.fn(),
  };

  beforeEach(async () => {
    auth.user.set(null);
    auth.renderSignInButton.mockClear();
    auth.signOut.mockClear();
    await TestBed.configureTestingModule({
      imports: [AuthControlComponent],
      providers: [{ provide: GoogleAuthService, useValue: auth }],
    }).compileComponents();
    fixture = TestBed.createComponent(AuthControlComponent);
    fixture.detectChanges();
  });

  it('renders the GIS button when signed out', () => {
    expect(fixture.nativeElement.querySelector('.google-sign-in-button')).toBeTruthy();
    expect(auth.renderSignInButton).toHaveBeenCalledOnce();
  });

  it('shows account details and signs out from the menu', async () => {
    auth.user.set({
      sub: 'google-sub',
      email: 'member@example.org',
      name: 'Workspace Member',
      picture: '',
    });
    fixture.detectChanges();

    const trigger = fixture.nativeElement.querySelector('.account-trigger') as HTMLButtonElement;
    expect(trigger.getAttribute('aria-label')).toBe('Account menu for member@example.org');
    expect(trigger.textContent).toContain('W');

    const loader = TestbedHarnessEnvironment.loader(fixture);
    const menu = await loader.getHarness(MatMenuHarness);
    await menu.open();
    expect(await menu.getItems()).toHaveLength(1);
    await menu.clickItem({ text: 'Sign out' });
    expect(auth.signOut).toHaveBeenCalledOnce();
  });

  it('shows the profile image when the account has one', () => {
    auth.user.set({
      sub: 'google-sub',
      email: 'member@example.org',
      name: 'Workspace Member',
      picture: 'https://example.org/avatar.png',
    });
    fixture.detectChanges();

    const image = fixture.nativeElement.querySelector('.account-trigger img') as HTMLImageElement;
    expect(image.src).toBe('https://example.org/avatar.png');
    expect(image.alt).toBe('Workspace Member');
  });
});