const { createElement } = React;

const rootEl = document.getElementById('shapegrid-root');
// create a mounting container inside the root so the canvas can be sized
rootEl.style.zIndex = '0';
rootEl.style.pointerEvents = 'none';

const mountNode = document.createElement('div');
mountNode.style.width = '100%';
mountNode.style.height = '100%';
mountNode.style.position = 'relative';
mountNode.style.pointerEvents = 'none';
rootEl.appendChild(mountNode);

const root = ReactDOM.createRoot(mountNode);

root.render(
    createElement(ShapeGrid, {
        // reduced speed for a calmer animation
        speed: 0.15,
        squareSize: 40,
        direction: 'diagonal',
        borderColor: '#fff',
        // stronger hover fill for dark mode
        hoverFillColor: 'rgb(128, 124, 128)',
        shape: 'square',
        hoverTrailAmount: 5,
        className: ''
    })
);
