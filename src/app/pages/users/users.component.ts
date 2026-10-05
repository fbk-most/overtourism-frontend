import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UserService } from '../../services/user.service';
import { AuthenticationService } from '../../services/authentication.service';
import { ScenarioService } from '../../services/scenario.service';
import { NotificationService } from '../../services/notifications.service';
import { AuthRole, AuthUser, CreateAuthUserDto, UpdateAuthUserDto } from '../../models/user.model';

@Component({
  selector: 'app-users',
  standalone: false,
  templateUrl: './users.component.html',
  styleUrl: './users.component.scss'
})
export class UsersComponent implements OnInit {
  users: AuthUser[] = [];
  roles: AuthRole[] = [];
  territories: string[] = [];
  loading = false;

  showModal = false;
  isEditMode = false;
  selectedUserId: string | null = null;
  userForm!: FormGroup;

  constructor(
    private userService: UserService,
    public authService: AuthenticationService,
    private scenarioService: ScenarioService,
    private notificationService: NotificationService,
    private fb: FormBuilder
  ) {
    this.initForm();
  }

  ngOnInit(): void {
    this.loadData();
  }

  private initForm(): void {
    this.userForm = this.fb.group({
      identifier: ['', [Validators.required, Validators.email]],
      role: ['viewer', Validators.required],
      territories: [[]],
      is_active: [true]
    });
  }

  loadData(): void {
    this.loading = true;

    this.scenarioService.getTerritories().subscribe({
      next: (t) => this.territories = (t || []).filter(item => item.toLowerCase() !== 'default')
    });

    this.userService.getRoles().subscribe({
      next: (r) => this.roles = r,
      error: (err) => console.error('Errore ruoli:', err)
    });

    this.userService.getUsers().subscribe({
      next: (u) => {
        this.users = u;
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.notificationService.showError('Errore durante il caricamento degli utenti');
      }
    });
  }

  openCreateModal(): void {
    this.isEditMode = false;
    this.selectedUserId = null;
    this.userForm.reset({
      identifier: '',
      role: 'viewer',
      territories: [],
      is_active: true
    });
    this.userForm.get('identifier')?.enable();
    this.showModal = true;
  }

  openEditModal(user: AuthUser): void {
    this.isEditMode = true;
    this.selectedUserId = user.user_id;
    this.userForm.reset({
      identifier: user.identifier,
      role: user.role,
      territories: user.territories || [],
      is_active: user.is_active
    });
    this.userForm.get('identifier')?.disable();
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
  }

  onRoleChange(): void {
    const role = this.userForm.get('role')?.value;
    // Admin e multieditor hanno accesso a tutti i territori (territories vuoto)
    if (role === 'admin' || role === 'multieditor') {
      this.userForm.get('territories')?.setValue([]);
    }
  }

  get hasTerritorySelection(): boolean {
    const role = this.userForm.get('role')?.value;
    return role === 'editor' || role === 'viewer';
  }

  toggleTerritory(terr: string): void {
    const current: string[] = this.userForm.get('territories')?.value || [];
    const idx = current.indexOf(terr);
    
    if (idx > -1) {
      this.userForm.get('territories')?.setValue(current.filter(t => t !== terr));
    } else {
      this.userForm.get('territories')?.setValue([...current, terr]);
    }
  }

  isTerritorySelected(terr: string): boolean {
    const list: string[] = this.userForm.get('territories')?.value || [];
    return list.includes(terr);
  }

  onSubmit(): void {
    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      return;
    }

    const formVal = this.userForm.getRawValue();
    const isGlobal = formVal.role === 'admin' || formVal.role === 'multieditor';

    // Validazione: editor e viewer devono avere almeno 1 territorio selezionato
    if (!isGlobal && (!formVal.territories || formVal.territories.length === 0)) {
      this.notificationService.showError('Seleziona almeno un territorio per il ruolo ' + formVal.role.toUpperCase());
      return;
    }

    if (this.isEditMode && this.selectedUserId) {
      const payload: UpdateAuthUserDto = {
        role: formVal.role,
        territories: isGlobal ? [] : formVal.territories,
        is_active: formVal.is_active
      };

      this.userService.updateUser(this.selectedUserId, payload).subscribe({
        next: () => {
          this.notificationService.showSuccess('Utente aggiornato con successo');
          this.closeModal();
          this.loadData();
        },
        error: () => this.notificationService.showError("Errore durante l'aggiornamento dell'utente")
      });
    } else {
      const payload: CreateAuthUserDto = {
        identifier: formVal.identifier,
        role: formVal.role,
        territories: isGlobal ? [] : formVal.territories
      };

      this.userService.createUser(payload).subscribe({
        next: () => {
          this.notificationService.showSuccess('Utente creato con successo');
          this.closeModal();
          this.loadData();
        },
        error: () => this.notificationService.showError("Errore durante la creazione dell'utente")
      });
    }
  }

  onDeactivate(user: AuthUser): void {
    if (confirm(`Sei sicuro di voler disattivare l'utente ${user.identifier}?`)) {
      this.userService.deactivateUser(user.user_id).subscribe({
        next: () => {
          this.notificationService.showSuccess('Utente disattivato');
          this.loadData();
        },
        error: () => this.notificationService.showError('Errore durante la disattivazione')
      });
    }
  }
}