import {
  Component,
  Input,
  Output,
  EventEmitter,
  ElementRef,
  ViewChild,
  OnInit,
  OnDestroy,
  ChangeDetectorRef,
  ViewContainerRef,
  TemplateRef,
  EmbeddedViewRef
} from '@angular/core';

type FunctionSource = (query: string, populateResults: (results: string[]) => void) => void;

@Component({
  selector: 'app-autocomplete',
  templateUrl: './autocomplete.component.html',
  styleUrls: ['./autocomplete.component.scss'],
  standalone: false
})
export class AutocompleteComponent implements OnInit, OnDestroy {
  @Input() source: string[] | FunctionSource = [];
  @Input() label = '';
  @Input() placeholder = '';
  @Input() minLength = 0;
  @Input() showAllOnFocus = true;
  @Input() maxResults = 200;

  @Output() selected = new EventEmitter<string>();

  @ViewChild('inputEl', { static: true }) inputEl!: ElementRef<HTMLInputElement>;
  @ViewChild('panelTemplate', { static: true }) panelTemplate!: TemplateRef<any>;

  inputValue = '';
  filtered: string[] = [];
  panelOpen = false;
  highlighted = -1;

  private viewRef?: EmbeddedViewRef<any>;
  private panelEl?: HTMLElement;

  private outsideClickHandler = (e: Event) => {
    if (!this.el.nativeElement.contains(e.target) && !this.panelEl?.contains(e.target as Node)) {
      this.closePanel();
    }
  };

  constructor(
    private el: ElementRef,
    private cdr: ChangeDetectorRef,
    private vcr: ViewContainerRef
  ) {}

  ngOnInit(): void {
    document.addEventListener('click', this.outsideClickHandler);
  }

  ngOnDestroy(): void {
    document.removeEventListener('click', this.outsideClickHandler);
    this.closePanel(true);
  }

  // === Input & filtro ===
  onFocus(): void {
    if (this.showAllOnFocus && this.minLength === 0) {
      this.updateResults('');
      if (this.filtered.length) this.openPanel();
    }
  }

  onInput(): void {
    const q = this.inputValue ?? '';
    if (q.length < this.minLength) {
      this.closePanel();
      return;
    }
    this.updateResults(q);
    this.filtered.length ? this.openPanel() : this.closePanel();
  }

  updateResults(query: string): void {
    if (typeof this.source === 'function') {
      (this.source as FunctionSource)(query, results => {
        this.filtered = (results || []).slice(0, this.maxResults);
        this.highlighted = this.filtered.length ? 0 : -1;
      });
    } else {
      const q = query.toLowerCase();
      this.filtered = (this.source as string[])
        .filter(s => s.toLowerCase().includes(q))
        .slice(0, this.maxResults);
      this.highlighted = this.filtered.length ? 0 : -1;
    }
  }

  // === Apertura dinamica del pannello ===
  // Definisci il riferimento unico come proprietà della classe
  private boundPositionPanel = () => this.positionPanel();

  openPanel(): void {
    if (this.panelOpen) return;
    this.panelOpen = true;

    this.viewRef = this.vcr.createEmbeddedView(this.panelTemplate);
    this.cdr.detectChanges();

    setTimeout(() => {
      this.panelEl = this.viewRef?.rootNodes[0] as HTMLElement;
      if (!this.panelEl) return;

      document.body.appendChild(this.panelEl);
      this.positionPanel();

      window.addEventListener('scroll', this.boundPositionPanel, true);
      window.addEventListener('resize', this.boundPositionPanel);
    });
  }

  private positionPanel(): void {
    if (!this.panelEl) return;
    const rect = this.inputEl.nativeElement.getBoundingClientRect();
    Object.assign(this.panelEl.style, {
      position: 'fixed',
      top: `${rect.bottom}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      margin: '0',
      zIndex: '3000'
    });
  }

  closePanel(force = false): void {
    if (!this.panelOpen && !force) return;
    this.panelOpen = false;
    this.highlighted = -1;

    window.removeEventListener('scroll', this.boundPositionPanel, true);
    window.removeEventListener('resize', this.boundPositionPanel);

    if (this.panelEl && document.body.contains(this.panelEl)) {
      document.body.removeChild(this.panelEl);
    }
    this.panelEl = undefined;
    this.viewRef?.destroy();
  }

  select(item: string): void {
    if (!item) return;
    this.selected.emit(item);
    this.inputValue = '';
    this.filtered = [];
    this.closePanel();
  }

  onKeyDown(e: KeyboardEvent): void {
    if (!this.panelOpen) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.highlighted = Math.min(this.highlighted + 1, this.filtered.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.highlighted = Math.max(this.highlighted - 1, 0);
    } else if (e.key === 'Enter' && this.highlighted >= 0) {
      e.preventDefault();
      this.select(this.filtered[this.highlighted]);
    } else if (e.key === 'Escape') {
      this.closePanel();
    }
  }

  clear(): void {
    this.inputValue = '';
    this.filtered = [];
    this.closePanel();
  }
}
