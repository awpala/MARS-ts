/*
Copyright (c) 2003-2007,  Pete Sanderson and Kenneth Vollmar

Developed by Pete Sanderson (psanderson@otterbein.edu)
and Kenneth Vollmar (kenvollmar@missouristate.edu)

Permission is hereby granted, free of charge, to any person obtaining 
a copy of this software and associated documentation files (the 
"Software"), to deal in the Software without restriction, including 
without limitation the rights to use, copy, modify, merge, publish, 
distribute, sublicense, and/or sell copies of the Software, and to 
permit persons to whom the Software is furnished to do so, subject 
to the following conditions:

The above copyright notice and this permission notice shall be 
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, 
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF 
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. 
IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR 
ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF 
CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION 
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

(MIT license, http://www.opensource.org/licenses/mit-license.html)
 */
// Ports mars/simulator/DelayedBranch.java.

/** One session's pending branch and delay-slot state; no external resources. */
export class DelayedBranch {
  private static readonly CLEARED = 0;
  private static readonly REGISTERED = 1;
  private static readonly TRIGGERED = 2;
  private state = DelayedBranch.CLEARED;
  private branchTargetAddress = 0;

  /** Register a branch; nested branches extend the delay slot but retain the first target. */
  register(targetAddress: number): void {
    if (this.state === DelayedBranch.CLEARED) this.branchTargetAddress = targetAddress | 0;
    this.state = DelayedBranch.REGISTERED;
  }

  /** Mark a pending branch triggered at the end of its instruction cycle. */
  trigger(): void {
    if (this.state !== DelayedBranch.CLEARED) this.state = DelayedBranch.TRIGGERED;
  }

  /** Clear the pending branch after the simulator applies its target. */
  clear(): void {
    this.state = DelayedBranch.CLEARED;
    this.branchTargetAddress = 0;
  }

  /** Whether a branch is registered and awaiting the end-of-cycle trigger. */
  isRegistered(): boolean {
    return this.state === DelayedBranch.REGISTERED;
  }

  /** Whether the delay slot can complete and apply the pending target. */
  isTriggered(): boolean {
    return this.state === DelayedBranch.TRIGGERED;
  }

  /** Return the signed 32-bit target; the simulator reads this after the delay slot. */
  getBranchTargetAddress(): number {
    return this.branchTargetAddress;
  }
}
