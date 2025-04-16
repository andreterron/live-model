// import { map, startWith, Subject, shareReplay } from 'rxjs';

describe('git branch action', () => {
  type BranchEvent = {
    old: string;
    new: string;
  };

  // test('git branch', async () => {
  //   let branchSubject = new Subject<BranchEvent>();
  //   let mockCurrentBranch = 'main';
  //   let resolveSwitch: (() => void) | undefined;

  //   function gitCurrentBranch() {
  //     return mockCurrentBranch;
  //   }

  //   async function switchBranch(name: string) {
  //     return new Promise<void>((resolve) => {
  //       resolveSwitch = resolve;
  //     });
  //   }

  //   // "Live" (Using Observable for now)

  //   const branch = branchSubject.pipe(
  //     map((ev) => ev.new),
  //     startWith(gitCurrentBranch()),
  //     shareReplay({ refCount: true, bufferSize: 1 })
  //   );

  //   const next = vi.fn();

  //   const sub = branch.subscribe({ next, error: (e) => console.error(e) });

  //   // What does this action mean?
  //   // Do we want it to be `branch.switch('feature')` ?
  //   const switchPromise = switchBranch('feature');
  //   branchSubject.next({
  //     old: 'main',
  //     new: 'feature',
  //   });
  //   resolveSwitch?.();

  //   // TODO: What behavior do we want?
  //   //       1. Optimistically update to the new branch
  //   //       2. Optimistically update to the new branch, but have metadata indicating that it's "busy" until the action finishes
  //   //       3. Have metadata indicating that it's "busy",
  //   //          then update to the new value when we get notified that the branch changed,
  //   //          before the `git switch` finishes
  //   //       4. Have metadata indicating that it's "busy",
  //   //          then update to the new value when the action promise is done,
  //   //          even if we get notified that the branch updated ealier.
  //   //       5. Configurable when calling the action. `branch.switch('feature', { optimistic: true })`
  //   //       6. Configurable when subscribing. `useLive(branch, { optimistic: true })` or `branch.subscribe({ next, ... }, { optimistic: true })
  //   //       7. Configurable at the object. `branch = repo.branch.withConfig({ optimistic: true })`
  //   //       8. They can get both the confirmed and optimistic values. Letting them show UI like (main -> feature)
  //   // The value of the object that triggered the action shouldn't update until the action finishes...
  //   // Or maybe it should, if we want to optimistically update.
  //   await switchPromise;

  //   sub.unsubscribe();
  // });
});
