document.addEventListener('DOMContentLoaded', () => {
    const dataInput = document.getElementById('data-input');
    const canvas = document.getElementById('visualizer');
    const ctx = canvas.getContext('2d');

    const PADDING = { top: 30, right: 100, bottom: 30, left: 100 };
    const GRAPH_WIDTH = 1440;
    const CANVAS_WIDTH = GRAPH_WIDTH + PADDING.left + PADDING.right;

    const setupCanvas = () => {
        const dpr = window.devicePixelRatio || 1;
        canvas.style.width = `${CANVAS_WIDTH}px`;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * dpr;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const drawGraph = () => {
        setupCanvas();

        const minuteWidth = GRAPH_WIDTH / (24 * 60);

        const lines = dataInput.value.trim().split('\n').filter(line => line.trim() !== '');
        const sleepPeriods = [];

        lines.forEach(line => {
            const parts = line.match(/(\d{4}-\d{2}-\d{2} \d{2}:\d{2}) (\d{4}-\d{2}-\d{2} \d{2}:\d{2})/);
            if (parts && parts.length === 3) {
                const start = new Date(parts[1]);
                const end = new Date(parts[2]);
                if (!isNaN(start) && !isNaN(end) && start < end) {
                    sleepPeriods.push({ start, end });
                }
            }
        });

        const dayHeight = 60;
        let totalHeight = dayHeight;
        let uniqueDates = [];
        const dailySleep = new Map();

        if (sleepPeriods.length > 0) {
            uniqueDates = [...new Set(sleepPeriods.flatMap(p => {
                 const dates = [];
                 let current = new Date(p.start);
                 current.setHours(0,0,0,0);
                 while(current < p.end){
                     dates.push(current.getTime());
                     current.setDate(current.getDate() + 1);
                 }
                 return dates;
            }))].sort((a, b) => a - b).map(t => new Date(t));

            uniqueDates.forEach(d => dailySleep.set(d.getTime(), 0));

            const chartHeight = uniqueDates.length * dayHeight;
            totalHeight = chartHeight + PADDING.top + PADDING.bottom;
        }

        const dpr = window.devicePixelRatio || 1;
        canvas.height = totalHeight * dpr;
        canvas.style.height = `${totalHeight}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        ctx.fillStyle = '#2c2c2c';
        ctx.fillRect(0, 0, CANVAS_WIDTH, totalHeight);
        ctx.font = `14px 'Ubuntu', sans-serif`;
        ctx.textBaseline = 'middle';

        ctx.strokeStyle = '#444';
        ctx.fillStyle = '#aaa';
        ctx.textAlign = 'center';
        for (let hour = 0; hour <= 24; hour++) {
            const x = PADDING.left + hour * 60 * minuteWidth;
            ctx.fillText(hour, x, PADDING.top / 2);
            if (hour < 24) {
                ctx.beginPath();
                ctx.moveTo(x, PADDING.top);
                ctx.lineTo(x, totalHeight - PADDING.bottom);
                ctx.stroke();
            }
        }

        if (sleepPeriods.length === 0) return;

        ctx.fillStyle = 'rgba(106, 136, 238, 0.8)';
        sleepPeriods.forEach(period => {
            let currentStart = new Date(period.start);

            while (currentStart < period.end) {
                const dayOfStart = new Date(currentStart);
                dayOfStart.setHours(0, 0, 0, 0);

                const dayIndex = uniqueDates.findIndex(d => d.getTime() === dayOfStart.getTime());
                if (dayIndex === -1) {
                    break; 
                }

                const currentY = PADDING.top + dayIndex * dayHeight;
                const nextMidnight = new Date(currentStart);
                nextMidnight.setHours(24, 0, 0, 0);

                const endOfSegment = (period.end < nextMidnight) ? period.end : nextMidnight;
                
                const duration = (endOfSegment - currentStart) / (1000 * 60);
                dailySleep.set(dayOfStart.getTime(), (dailySleep.get(dayOfStart.getTime()) || 0) + duration);

                // --- Corner Radius Logic ---
                const baseRadius = 20; // Increased radius
                let cornerRadii = [baseRadius, baseRadius, baseRadius, baseRadius]; // [TL, TR, BR, BL]

                const isFirstSegment = period.start.getTime() === currentStart.getTime();
                const isLastSegment = period.end.getTime() === endOfSegment.getTime();

                if (!isFirstSegment) { // This segment is a continuation from a previous day
                    cornerRadii[0] = 0; // Top-left
                    cornerRadii[3] = 0; // Bottom-left
                }
                if (!isLastSegment) { // This segment continues to the next day
                    cornerRadii[1] = 0; // Top-right
                    cornerRadii[2] = 0; // Bottom-right
                }
                // --- End Corner Radius Logic ---

                const startMinutes = currentStart.getHours() * 60 + currentStart.getMinutes();
                const x = PADDING.left + startMinutes * minuteWidth;
                const width = duration * minuteWidth;

                if (width > 0) {
                    ctx.beginPath();
                    ctx.roundRect(x, currentY + dayHeight * 0.15, width, dayHeight * 0.7, cornerRadii);
                    ctx.fill();
                }
                
                currentStart = endOfSegment;
            }
        });

        // --- Draw Date Labels (Last, with Shadow) ---
        const dayOfWeek = ['日', '月', '火', '水', '木', '金', '土'];
        uniqueDates.forEach((date, i) => {
            const y = PADDING.top + i * dayHeight + dayHeight / 2;

            // --- Date Label ---
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const dow = dayOfWeek[date.getDay()];
            const dateString = `${year}-${month}-${day}(${dow})`;
            
            const x = PADDING.left + 10;

            ctx.textAlign = 'left';
            ctx.font = `16px 'Ubuntu', sans-serif`; // Not bold
            ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
            ctx.shadowBlur = 5;
            ctx.fillStyle = '#ffffff';
            ctx.fillText(dateString, x, y);

            // --- Sleep Duration Label ---
            const dateLabelWidth = ctx.measureText(dateString).width;
            const totalMinutes = dailySleep.get(date.getTime()) || 0;
            const hours = Math.floor(totalMinutes / 60);
            const minutes = Math.round(totalMinutes % 60);
            const timeString = `${String(hours).padStart(2, '0')}h${String(minutes).padStart(2, '0')}m`;

            ctx.font = `14px 'Ubuntu', sans-serif`;
            ctx.fillStyle = '#dddddd'; // Brighter gray color
            ctx.fillText(timeString, x + dateLabelWidth + 10, y); // Position after date label

            ctx.shadowColor = 'transparent'; // Reset shadow for next loop iteration
            ctx.shadowBlur = 0;
        });
    };

    dataInput.addEventListener('input', drawGraph);
    drawGraph();

    // --- Copy Button Logic ---
    const copyButton = document.getElementById('copy-button');
    copyButton.addEventListener('click', () => {
        canvas.toBlob(async (blob) => {
            if (!blob) {
                alert('画像の生成に失敗しました。');
                return;
            }
            try {
                const item = new ClipboardItem({ 'image/png': blob });
                await navigator.clipboard.write([item]);
                
                const originalText = copyButton.textContent;
                copyButton.textContent = 'コピーしました！';
                copyButton.disabled = true;
                setTimeout(() => {
                    copyButton.textContent = originalText;
                    copyButton.disabled = false;
                }, 2000);

            } catch (err) {
                console.error('画像のコピーに失敗しました: ', err);
                alert('画像のコピーに失敗しました。ブラウザまたはOSが対応していない可能性があります。');
            }
        }, 'image/png');
    });
});