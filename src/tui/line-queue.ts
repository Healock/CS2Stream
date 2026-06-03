export class LineQuestionQueue {
  private readonly lines: string[] = [];
  private pendingResolve?: (value: string | undefined) => void;
  private closed = false;

  pushLine(line: string): void {
    if (this.closed) {
      return;
    }

    if (this.pendingResolve) {
      const resolve = this.pendingResolve;
      this.pendingResolve = undefined;
      resolve(line);
      return;
    }

    this.lines.push(line);
  }

  question(): Promise<string | undefined> {
    const line = this.lines.shift();
    if (line !== undefined) {
      return Promise.resolve(line);
    }

    if (this.closed) {
      return Promise.resolve(undefined);
    }

    return new Promise((resolve) => {
      this.pendingResolve = resolve;
    });
  }

  close(): void {
    this.closed = true;
    if (this.pendingResolve) {
      const resolve = this.pendingResolve;
      this.pendingResolve = undefined;
      resolve(undefined);
    }
  }
}
