import { jsx as _jsx } from "react/jsx-runtime";
import { Composition, useCurrentFrame, interpolate, AbsoluteFill } from 'remotion';
import { AppCharacter, ChefCharacter, CustomerCharacter, WorkerCharacter } from '../components/Characters';
import { Restaurant, Bakery, Library, Factory } from '../components/Buildings';
import { MessageBox, LoadingSpinner, DataPacket, Table, Meal, OrderTicket } from '../components/UIElements';
const AnimationComposition = () => {
    // Assuming 30 fps, max 60 seconds
    const fps = 30;
    const maxDurationInFrames = 60 * fps;
    return (_jsx(Composition, { id: "AnimationComposition", component: AnimationRenderer, durationInFrames: maxDurationInFrames, fps: fps, width: 1920, height: 1080, defaultProps: {
            animationScript: {
                totalDuration: 0,
                scenes: [],
                voiceover: { text: '', segments: [] },
                style: {
                    backgroundColor: '#fff',
                    primaryColor: '#000',
                    secondaryColor: '#000',
                    accentColor: '#000',
                    fontFamily: 'Arial',
                    theme: 'light'
                }
            },
        } }));
};
const AnimationRenderer = ({ animationScript }) => {
    const frame = useCurrentFrame();
    const fps = 30;
    const currentTime = (frame / fps) * 1000; // in ms
    // Find the current scene
    const currentScene = animationScript.scenes.find((scene) => currentTime >= scene.startTime && currentTime < scene.endTime);
    if (!currentScene) {
        return (_jsx(AbsoluteFill, { style: { backgroundColor: animationScript.style.backgroundColor }, children: _jsx("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%',
                    fontSize: '48px',
                    color: animationScript.style.primaryColor,
                    fontFamily: animationScript.style.fontFamily,
                }, children: animationScript.voiceover.text || 'Loading...' }) }));
    }
    if (currentScene.elements.length === 0) {
        return (_jsx(AbsoluteFill, { style: { backgroundColor: animationScript.style.backgroundColor }, children: _jsx("div", { style: {
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '100%',
                    height: '100%',
                    fontSize: '48px',
                    color: animationScript.style.primaryColor,
                    fontFamily: animationScript.style.fontFamily,
                }, children: currentScene.description }) }));
    }
    return (_jsx(AbsoluteFill, { style: {
            backgroundColor: animationScript.style.backgroundColor,
            fontFamily: animationScript.style.fontFamily,
            color: animationScript.style.primaryColor,
        }, children: currentScene.elements.map((element, index) => {
            const safeElement = {
                ...element,
                x: element.x || 0,
                y: element.y || 0,
                color: element.color || animationScript.style.primaryColor,
            };
            // Calculate animated position
            let currentX = safeElement.x;
            let currentY = safeElement.y;
            if (element.animation) {
                const sceneStart = currentScene.startTime;
                const sceneEnd = currentScene.endTime;
                if (currentTime >= sceneStart && currentTime <= sceneEnd) {
                    const sceneProgress = (currentTime - sceneStart) / (sceneEnd - sceneStart);
                    const progress = Math.min(sceneProgress, 1);
                    currentX = interpolate(progress, [0, 1], [element.animation.from.x, element.animation.to.x]);
                    currentY = interpolate(progress, [0, 1], [element.animation.from.y, element.animation.to.y]);
                }
            }
            const style = {
                position: 'absolute',
                left: `${currentX}px`,
                top: `${currentY}px`,
            };
            let content;
            switch (element.type) {
                case 'character':
                    switch (element.name) {
                        case 'AppCharacter':
                            content = _jsx(AppCharacter, { x: 0, y: 0, emotion: element.emotion || 'happy' });
                            break;
                        case 'ChefCharacter':
                            content = _jsx(ChefCharacter, { x: 0, y: 0, emotion: element.emotion || 'neutral' });
                            break;
                        case 'CustomerCharacter':
                            content = _jsx(CustomerCharacter, { x: 0, y: 0, emotion: element.emotion || 'happy' });
                            break;
                        case 'WorkerCharacter':
                            content = _jsx(WorkerCharacter, { x: 0, y: 0, emotion: element.emotion || 'neutral' });
                            break;
                        default:
                            content = _jsx(AppCharacter, { x: 0, y: 0, emotion: element.emotion || 'happy' });
                    }
                    break;
                case 'building':
                    switch (element.name) {
                        case 'Restaurant':
                            content = _jsx(Restaurant, { x: 0, y: 0, status: element.status || 'open' });
                            break;
                        case 'Bakery':
                            content = _jsx(Bakery, { x: 0, y: 0, status: element.status || 'open' });
                            break;
                        case 'Library':
                            content = _jsx(Library, { x: 0, y: 0, status: element.status || 'open' });
                            break;
                        case 'Factory':
                            content = _jsx(Factory, { x: 0, y: 0, status: element.status || 'open' });
                            break;
                        default:
                            content = _jsx(Restaurant, { x: 0, y: 0, status: element.status || 'open' });
                    }
                    break;
                case 'messageBox':
                    content = _jsx(MessageBox, { x: 0, y: 0, type: "info", text: element.content || '' });
                    break;
                case 'loadingSpinner':
                    content = _jsx(LoadingSpinner, { x: 0, y: 0 });
                    break;
                case 'dataPacket':
                    content = _jsx(DataPacket, { x: 0, y: 0, label: element.content || 'Data', color: safeElement.color });
                    break;
                case 'table':
                    content = _jsx(Table, { x: 0, y: 0, width: element.width || 100, height: element.height || 60 });
                    break;
                case 'meal':
                    content = _jsx(Meal, { x: 0, y: 0, type: element.mealType || 'plate' });
                    break;
                case 'orderTicket':
                    content = _jsx(OrderTicket, { x: 0, y: 0, itemCount: element.itemCount || 1, status: element.status || 'pending' });
                    break;
                case 'background':
                    content = _jsx("div", { style: { width: '100%', height: '100%', backgroundColor: safeElement.color } });
                    break;
                case 'element':
                    content = _jsx("div", { style: { width: 60, height: 60, backgroundColor: safeElement.color, borderRadius: 8 } });
                    break;
                case 'text':
                default:
                    content = _jsx("div", { style: { color: safeElement.color, fontSize: '24px', fontWeight: 'bold' }, children: element.content });
                    break;
            }
            return (_jsx("div", { style: style, children: content }, index));
        }) }));
};
export { AnimationComposition, AnimationRenderer };
//# sourceMappingURL=AnimationComposition.js.map