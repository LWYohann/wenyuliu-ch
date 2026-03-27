function parseColorInput(colorstring) {
    // parse hex, rgb, rgba, hsl, hsla color formats and return a hex string with alpha
    const ctx = document.createElement('canvas').getContext('2d');
    ctx.fillStyle = colorstring;
    return (ctx.fillStyle).toUpperCase(); // returns in rgba format in capital letters
}


let currentData = [];
let currentLayout = {};
const plotDiv = document.getElementById('plot-container');

let fileName; // Store the uploaded file name for export

// Handle File Upload
document.getElementById('fileInput').addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    fileName = file.name.replace('.json', '');
    const reader = new FileReader();
    reader.onload = function(event) {
        try {
            const json = JSON.parse(event.target.result);
            
            // Plotly JSON usually has data and layout keys
            currentData = json.data || [];
            currentLayout = json.layout || {};
            
            renderPlot();
        } catch (err) {
            alert("Error parsing JSON: " + err.message);
        }
    };
    reader.readAsText(file);
});

// Render Plot
function renderPlot() {

    Plotly.newPlot(plotDiv, currentData, currentLayout);

    const transparentBg = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)'
    }

    Plotly.relayout(plotDiv, transparentBg)

    // Update sidebar inputs based on rendered plot: #plot-container
    const plotWidth = plotDiv.offsetWidth;
    const plotHeight = plotDiv.offsetHeight;
    document.getElementById('plotWidth').value = plotWidth;
    document.getElementById('plotHeight').value = plotHeight;
    document.getElementById('bgColor').value = parseColorInput(plotDiv.style.backgroundColor || '#FFFFFF'); // default white
    document.getElementById('fontFamily').value = (currentLayout.font && currentLayout.font.family) || 'Arial';

}

// Update Layout (Resize, Color, Font)
function updateLayout() {
    if (!currentData.length) return;

    const bgOpacity = parseFloat(document.getElementById('bgOpacity').value);
    // convert to hex
    const opacityHex = Math.round(bgOpacity * 255).toString(16).padStart(2, '0');

    const setColor = parseColorInput(document.getElementById('bgColor').value);

    const update = {
        width: document.getElementById('plotWidth').value,
        height: document.getElementById('plotHeight').value,
        paper_bgcolor: setColor + opacityHex,
        plot_bgcolor: setColor + opacityHex,
        font: { family: document.getElementById('fontFamily').value, color: currentLayout.font.color || '#000' }
    };

    // only update the properties that exist in currentLayout to avoid overwriting other settings
    if (currentLayout.width) currentLayout.width = update.width;
    if (currentLayout.height) currentLayout.height = update.height;
    if (currentLayout.paper_bgcolor) currentLayout.paper_bgcolor = update.paper_bgcolor;
    if (currentLayout.plot_bgcolor) currentLayout.plot_bgcolor = update.plot_bgcolor;
    if (currentLayout.font) currentLayout.font.family = update.font.family;
    if (currentLayout.font) currentLayout.font.color = update.font.color;


    Plotly.relayout(plotDiv, currentLayout);
}

// Export SVG
function exportSVG() {
    if (!currentData.length) {
        alert("No plot to export!");
        return;
    }
    Plotly.downloadImage(plotDiv, {
        format: 'svg',
        width: document.getElementById('plotWidth').value,
        height: document.getElementById('plotHeight').value,
        filename: fileName || 'plotly_plot' 
    });
}

async function exportPDF() {
    if (!currentData.length) {
        alert("No plot to export!");
        return;
    }
    // first get SVG content and call svg-to-pdf converter
    const svgDataUrl = await Plotly.toImage(plotDiv, {
        format: 'svg',
        width: document.getElementById('plotWidth').value,
        height: document.getElementById('plotHeight').value,
        filename: fileName || 'plotly_plot' 
    });

    const svgContent = decodeURIComponent(svgDataUrl.split(',')[1]);

    createPDF(svgContent, (fileName || 'plotly_plot') + '.pdf');
}