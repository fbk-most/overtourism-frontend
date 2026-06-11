import { Component, Input, Output, EventEmitter, SimpleChanges } from "@angular/core";
import { ActivatedRoute, Router } from "@angular/router";
import { NotificationService } from "../../../services/notifications.service";
import { ProblemService } from "../../../services/problem.service";
import { TranslateService } from '@ngx-translate/core';
import { Proposal } from "../../../models/proposal.model";
import { Problem } from "../../../models/problem.model";

@Component({
  selector: 'app-problem-create',
  templateUrl: './problem-create.component.html',
  standalone: false,
  styleUrls: ['./problem-create.component.scss']
})
export class ProblemCreateComponent {

  @Input() editProblemId?: string;
  @Output() problemSaved = new EventEmitter<Problem>();
  @Output() problemCancel = new EventEmitter<void>();

  availableGroups = [] as { key: string; label: string }[];
  model = {
    name: '',
    objective: '',
    descriptionProblem: '',
    groups: {} as Record<string, boolean>,
    resources: [] as string[]
  };
  proposals: Proposal[] = [];
  newResource = '';

  savedProblemId?: string;
  isSaving = false;
  originalExtras: any = {};

  savedVersion?: number;
  savedTenant?: string;
  savedCreated?: Date;

  constructor(
    private svc: ProblemService,
    private route: ActivatedRoute,
    private router: Router,
    private notif: NotificationService,
    private translate: TranslateService
  ) {}

  ngOnInit() {
    this.availableGroups = [
      { key: 'Parcheggi', label: this.translate.instant('problems.fields.categories.parking') },
      { key: 'Spiaggia', label: this.translate.instant('problems.fields.categories.beach') },
      { key: 'Ristoranti', label: this.translate.instant('problems.fields.categories.restaurants') },
      { key: 'Alberghi', label: this.translate.instant('problems.fields.categories.hotels') }
    ];
  
    this.editProblemId = this.route.snapshot.queryParamMap.get('edit') || undefined;
    if (this.editProblemId) {
      this.loadProblem(this.editProblemId);
    }
  }
  ngOnChanges(changes: SimpleChanges) {
    if (changes["editProblemId"] && this.editProblemId) {
      this.loadProblem(this.editProblemId);
    }
  }
  loadProblem(problemId: string) {
    this.svc.getProblemById(problemId).subscribe({
      next: (res: any) => {
        this.savedProblemId = res.problem_id;
        this.savedVersion = res.version;
        this.savedTenant = res.tenant;
        this.savedCreated = res.created ? new Date(res.created) : undefined;
        this.model.name = res.name || '';
        this.model.descriptionProblem = res.description || '';
        this.originalExtras = res.extras || {};
        this.model.objective = this.originalExtras.objective || '';
        this.model.resources = this.originalExtras.links || this.originalExtras.resources || [];
        this.proposals = this.originalExtras.proposals || [];
        this.model.groups = {};
        this.availableGroups.forEach(g => this.model.groups[g.key] = false);
          (this.originalExtras.groups || []).forEach((g: string) => this.model.groups[g] = true);
      },
      error: (err) => this.notif.showError(err?.message || this.translate.instant('problems.load_error'))
    });
  }
  

  addResource() {
    if (this.newResource.trim()) {
      this.model.resources.push(this.newResource.trim());
      this.newResource = '';
    }
  }

  removeResource(i: number) {
    this.model.resources.splice(i, 1);
  }

  isUrl(str: string) {
    try { new URL(str); return true; } catch { return false; }
  }


  async onSubmit() {
    if (this.isSaving) return;
    this.isSaving = true;
  
    try {
      const payload: Problem = {
        problem_id: this.savedProblemId || '', 
        
        version: this.savedVersion,
        tenant: this.savedTenant,
        created: this.savedCreated,
        updated: new Date(),
        
        name: this.model.name,
        description: this.model.descriptionProblem,
        extras: {
          ...this.originalExtras, 
          objective: this.model.objective,
          groups: Object.keys(this.model.groups).filter(k => this.model.groups[k]),
          links: this.model.resources,
          proposals: this.proposals
        }
      };
  
      let res: any;
  
      if (this.editProblemId) {
      res = await this.svc.updateProblem(this.editProblemId, payload).toPromise();
      if (res && res.version) {
        this.savedVersion = res.version;
      }
      this.notif.showSuccess(
        this.translate.instant('problems.update_success', { name: payload.name })
      );
    } else {
      res = await this.svc.createProblem(payload).toPromise();
      if (res) {
        this.savedProblemId = res.problem_id;
        this.savedVersion = res.version;
        this.savedTenant = res.tenant;
        this.savedCreated = res.created ? new Date(res.created) : undefined;
      }
      this.savedProblemId = res?.problem_id;
      this.notif.showSuccess(
        this.translate.instant('problems.create_success', { name: payload.name })
      );
    }

    this.problemSaved.emit(res);
  } catch (err: any) {
    this.notif.showError(
      this.translate.instant('problems.create_error', { name: this.model.name }) ||
      err?.message
    );
  } finally {
    this.isSaving = false;
  }
}

  cancel() {
    this.router.navigate(['/problems']);
  }
  onCancel() {
    this.problemCancel.emit();
  }
}
