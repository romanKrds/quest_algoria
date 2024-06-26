import { Injectable, signal, WritableSignal } from '@angular/core';
import { Subject } from "rxjs";

@Injectable({
  providedIn: 'root'
})
export class CodeExecutionService {
  protected taskStateSubject = new Subject();
  taskState$ = this.taskStateSubject.asObservable();
  isExecutionInProgress = signal(false);
  watchDogTimerId: WritableSignal<number | undefined> = signal(undefined);
  private readonly executionTimeout = 4500;
  private readonly workerScript = `self.onmessage = function(e) {
    // Disable potentially harmfully API
    self.XMLHttpRequest = function() { throw new Error('XMLHttpRequest is disabled.'); };
    self.fetch = function() { throw new Error('fetch is disabled.'); };
    self.WebSocket = function() { throw new Error('WebSocket is disabled.'); };

    const code = e.data;
    try {
      const result = eval(code);
      self.postMessage({ type: 'result', data: result });
    } catch (error) {
      console.error(error)
      self.postMessage({ type: 'error', data: error.name + ': ' + error.message });
    }
    self.close();
  };`

  runJavaScriptCode(code: string): void {
    if (this.isExecutionInProgress()) return;

    const {worker, url} = this.createWorker();

    this.setupWorkerMessaging(worker, url);
    this.isExecutionInProgress.set(true);
    worker.postMessage(code);

    this.watchDogTimerId.set(
      setTimeout(() => {
        this.terminateWorker(worker, url, 'Error: Time for script execution exceeded. Check for possible infinite loops in your code.')
      }, this.executionTimeout)
    );
  }

  private createWorker() {
    const blob = new Blob([this.workerScript], {type: 'application/javascript'});
    const url = URL.createObjectURL(blob);
    const worker = new Worker(url);
    worker.onerror = (error) => {
      console.error('Error in worker:', error);
    };

    return {worker, url}
  }

  private setupWorkerMessaging(worker: Worker, url: string) {
    worker.onmessage = (e) => {
      if (e.data.type === 'result' || e.data.type === 'error') {
        this.taskStateSubject.next(e.data.data);
        this.terminateWorker(worker, url);
      }
    };
  }

  private terminateWorker(worker: Worker, url: string, error?: string) {
    clearTimeout(this.watchDogTimerId());
    worker.terminate();
    URL.revokeObjectURL(url);
    this.isExecutionInProgress.set(false);
    if (error) {
      this.taskStateSubject.next(error);
    }
  }
}
