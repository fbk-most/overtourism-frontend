// plot.config.ts
// export const SUBSYSTEM_OPTIONS = [
//     { value: 'default', label: 'Tutti' },
//     { value: 'parcheggi', label: 'Parcheggi' },
//     { value: 'spiaggia', label: 'Spiaggia' },
//     { value: 'alberghi', label: 'Alberghi' },
//     { value: 'ristoranti', label: 'Ristoranti' }
//   ];
  
  export const PLOT_COLORS = {
    sampleT: 'rgba(211, 211, 211, 0.7)',      // Light gray
    sampleE: 'rgba(64, 64, 64, 0.7)',         // Dark gray
    overThreshold: 'rgb(180,4,38)',
    underThreshold: 'rgb(5,102,8)',
    capacityMean: 'grey',
  };
  
 
  
  export const DEFAULT_LAYOUT: Partial<Plotly.Layout> = {
    showlegend: true,
    legend: {
      orientation: 'h',
      x: 0,
      y: -0.2,
      xanchor: 'left',
      yanchor: 'top'
    },
    margin: { l: 60, r: 60, t: 40, b: 50 }
  };
  // export const  RISK_COLOR_SCALE: Plotly.ColorScale = [
  //     [0.0, 'rgb(5, 102, 8)'],
  //     [0.05, 'rgb(100, 180, 90)'],
  //     [0.20, 'rgb(180, 230, 170)'],
  //     [0.40, 'rgb(230, 250, 225)'],
  //     [0.50, 'yellow'],
  //     [0.60, 'rgb(255, 242, 242)'],
  //     [0.80, 'rgb(242, 204, 204)'],
  //     [0.95, 'rgb(204, 76, 76)'],
  //     [1.0, 'rgb(180, 4, 38)']
  //   ];
    export const  DEFAULT_MARGIN_LAYOUT = { t: 50, b: 80, l: 80, r: 60 };
  