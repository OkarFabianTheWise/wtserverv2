import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
import { registerRoot } from 'remotion';
import { AnimationComposition } from './compositions/AnimationComposition';
/**
 * Remotion 2.0 Root Component
 * Entry point for Remotion rendering with dynamic animation support
 */
export const RemotionRoot = () => {
    return (_jsx(_Fragment, { children: _jsx(AnimationComposition, {}) }));
};
registerRoot(RemotionRoot);
//# sourceMappingURL=RemotionRoot.js.map