/*
 * Debugger follow-up requirements / TODOs:
 * 1. Time branching.
 * 2. A hook that decides whether operations conflict and require automatic branching.
 * 3. A hook that decides whether an operation is accepted.
 * 4. Visualize operation dependencies, because operations are not inherently ordered.
 */
import { MessageDebuggerV2 } from '../components/message-debugger-v2';

export default function DebuggerIndex() {
  return <MessageDebuggerV2 />;
}
