import { Injectable } from '@angular/core';
import { BehaviorSubject, filter, firstValueFrom, take, timeout } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ReportRenderService {
  private readonly pendingSubject = new BehaviorSubject(0);

  beginPlot(): () => void {
    this.pendingSubject.next(this.pendingSubject.value + 1);
    let completed = false;

    return () => {
      if (completed) return;
      completed = true;
      this.pendingSubject.next(Math.max(0, this.pendingSubject.value - 1));
    };
  }

  async waitForPlots(): Promise<void> {
    await firstValueFrom(
      this.pendingSubject.pipe(
        filter(pending => pending === 0),
        take(1),
        timeout(60_000)
      )
    );
  }
}
