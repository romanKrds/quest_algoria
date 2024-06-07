import { JsonPipe } from "@angular/common";
import { Component, EventEmitter, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { TranslateModule } from "@ngx-translate/core";
import { Subject, takeUntil } from "rxjs";
import { CodeExecutionService } from "../../../services/code-execution.service";

@Component({
  selector: 'app-algorithm-result',
  standalone: true,
  imports: [
    JsonPipe,
    TranslateModule
  ],
  templateUrl: './algorithm-result.component.html',
  styleUrl: './algorithm-result.component.scss'
})
export class AlgorithmResultComponent implements OnInit, OnDestroy {
  @Input({required: true}) congratulationText!: string;
  @Input({required: true}) matcher!: (result: any) => boolean
  @Output() match = new EventEmitter<boolean>();

  hasExecutedCode = false;
  hasMatch = false;
  actualResult: any;
  private destroy$: Subject<void> = new Subject();

  constructor(
    private codeExecutionService: CodeExecutionService
  ) {}

  ngOnInit() {
    this.codeExecutionService.taskState$
      .pipe(
        takeUntil(this.destroy$)
      )
      .subscribe((actualResult) => {
        this.hasExecutedCode = true;
        this.actualResult = actualResult;
        this.hasMatch = this.matcher(actualResult);
      });
  }

  ngOnDestroy() {
    this.destroy$.next()
    this.destroy$.unsubscribe();
  }

  onSaveAndProceed() {
    if (!this.hasMatch) {
      return
    }

    this.match.emit(this.hasMatch);
  }
}