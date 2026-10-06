/**
 * Hospital WaitTime Analytics Dashboard Logic
 * College Project LG-6: Reducing Hospital Waiting Time Using Sampling and Statistical Estimation
 * Dataset: 2022 NHAMCS Emergency Department Public-Use Data (CDC/NCHS)
 */

document.addEventListener('DOMContentLoaded', () => {
  // Global State
  const state = {
    method: 'baseline',
    sampleSize: 100,
    seed: 42,
    threshold: 60,
    cltN: 30,
    bootStat: 'median',
    bootIters: 1000,
    groupBy: 'SEX_LABEL',
    dataPage: 1,
    dataPageSize: 25,
    dataSearch: '',
    dataSortBy: 'WAITTIME',
    dataSortOrder: 'asc'
  };

  // Plotly Common Theme
  const plotlyLayoutDefaults = {
    font: { family: 'Inter, sans-serif', color: '#1E293B', size: 12 },
    paper_bgcolor: 'transparent',
    plot_bgcolor: '#FFFFFF',
    margin: { t: 30, r: 25, b: 45, l: 50 },
    xaxis: { gridcolor: '#F1F5F9', zerolinecolor: '#E2E8F0' },
    yaxis: { gridcolor: '#F1F5F9', zerolinecolor: '#E2E8F0' },
    hoverlabel: { font: { family: 'Inter, sans-serif' } }
  };
  const plotlyConfig = { responsive: true, displayModeBar: false };

  // =========================================================================
  // 1. Initial Load
  // =========================================================================
  initEventListeners();
  loadOverview();
  loadDistribution(40);
  runSamplingLab();
  loadCLT(state.cltN);
  loadBootstrap();
  loadLongWait(state.threshold);
  loadGroupComparison(state.groupBy);
  loadErrorCurve();
  loadDataExplorer();

  // =========================================================================
  // 2. Overview & KPIs (Section 2)
  // =========================================================================
  async function loadOverview() {
    try {
      const res = await fetch('/api/overview');
      const data = await res.json();

      document.getElementById('kpi-total-raw').textContent = Number(data.total_records_raw).toLocaleString();
      document.getElementById('kpi-valid-records').textContent = Number(data.valid_records).toLocaleString();
      
      document.getElementById('kpi-pop-mean').innerHTML = `${data.pop_mean.toFixed(3)} <span class="kpi-unit">min</span>`;
      document.getElementById('kpi-pop-median').innerHTML = `${data.pop_median.toFixed(1)} <span class="kpi-unit">min</span>`;
      document.getElementById('kpi-pop-max').innerHTML = `${Number(data.pop_max).toLocaleString()} <span class="kpi-unit">min</span>`;
      document.getElementById('kpi-pop-p60').innerHTML = `${data.pop_pct_60}% <span class="kpi-unit">(${data.pop_prop_60})</span>`;

      document.getElementById('kpi-sample-size-lbl').textContent = `n=${data.sample_size}`;
      document.getElementById('kpi-sample-mean').innerHTML = `${data.sample_mean.toFixed(2)} <span class="kpi-unit">min</span>`;
      document.getElementById('kpi-sample-median').innerHTML = `${data.sample_median.toFixed(2)} <span class="kpi-unit">min</span>`;
      document.getElementById('kpi-sample-p60').innerHTML = `${data.sample_pct_60}% <span class="kpi-unit">(${data.sample_prop_60})</span>`;

      document.getElementById('kpi-ci-mean').innerHTML = `${data.ci_mean[0]} – ${data.ci_mean[1]} <span class="kpi-unit">min</span>`;
      document.getElementById('kpi-ci-median').innerHTML = `${data.ci_median[0]} – ${data.ci_median[1]} <span class="kpi-unit">min</span>`;
      document.getElementById('kpi-ci-wilson').innerHTML = `${data.ci_proportion[0]} – ${data.ci_proportion[1]} <span class="kpi-unit">(${ (data.ci_proportion[0]*100).toFixed(1) }%–${ (data.ci_proportion[1]*100).toFixed(1) }%)</span>`;

      const modeBadge = document.getElementById('sample-mode-label');
      if (data.is_baseline) {
        modeBadge.textContent = 'Notebook Baseline Sample Active';
        modeBadge.parentElement.style.color = 'var(--accent-teal)';
      } else {
        modeBadge.textContent = `Interactive Sample (n=${data.sample_size})`;
        modeBadge.parentElement.style.color = 'var(--primary-blue)';
      }
    } catch (err) {
      console.error('Failed to load overview:', err);
    }
  }

  // =========================================================================
  // 3. Waiting-Time Distribution (Section 3)
  // =========================================================================
  async function loadDistribution(bins = 40) {
    try {
      const res = await fetch(`/api/distribution?bins=${bins}`);
      const data = await res.json();

      // Histogram
      const histTrace = {
        x: data.bin_centers,
        y: data.counts,
        type: 'bar',
        name: 'Visits',
        marker: { color: '#0284C7', opacity: 0.85, line: { color: '#0369A1', width: 1 } },
        hovertemplate: 'Wait Time: ~%{x:.0f} min<br>Count: %{y:,} visits<extra></extra>'
      };

      const histLayout = {
        ...plotlyLayoutDefaults,
        xaxis: { title: 'Waiting Time (Minutes, ≤300m for detail)', gridcolor: '#F1F5F9' },
        yaxis: { title: 'Frequency (Visits)', gridcolor: '#F1F5F9' },
        shapes: [
          {
            type: 'line', x0: data.mean, x1: data.mean, y0: 0, y1: Math.max(...data.counts) * 1.05,
            line: { color: '#E11D48', width: 2.5, dash: 'dash' }
          },
          {
            type: 'line', x0: data.median, x1: data.median, y0: 0, y1: Math.max(...data.counts) * 1.05,
            line: { color: '#0D9488', width: 2.5, dash: 'dot' }
          }
        ],
        annotations: [
          {
            x: data.mean, y: Math.max(...data.counts) * 0.95, text: `Mean: ${data.mean}m`,
            showarrow: true, arrowhead: 2, ax: 45, ay: -25,
            font: { color: '#E11D48', weight: 700 }
          },
          {
            x: data.median, y: Math.max(...data.counts) * 0.75, text: `Median: ${data.median}m`,
            showarrow: true, arrowhead: 2, ax: -45, ay: -25,
            font: { color: '#0D9488', weight: 700 }
          }
        ]
      };
      Plotly.newPlot('chart-histogram', [histTrace], histLayout, plotlyConfig);

      // Box Plot
      const bp = data.boxplot;
      const boxTrace = {
        type: 'box',
        name: 'WAITTIME',
        q1: [bp.q1],
        median: [bp.median],
        q3: [bp.q3],
        lowerfence: [bp.lower_fence],
        upperfence: [bp.upper_fence],
        boxpoints: false,
        marker: { color: '#0D9488' },
        line: { color: '#0F766E', width: 2 }
      };

      const boxLayout = {
        ...plotlyLayoutDefaults,
        xaxis: { title: '', showticklabels: false },
        yaxis: { title: 'Waiting Time (Minutes)', gridcolor: '#F1F5F9' }
      };
      Plotly.newPlot('chart-boxplot', [boxTrace], boxLayout, plotlyConfig);

      // Category Cards
      const catContainer = document.getElementById('category-cards-grid');
      catContainer.innerHTML = '';
      data.categories.forEach(cat => {
        const div = document.createElement('div');
        div.className = 'category-card';
        div.style.borderTopColor = cat.color;
        div.innerHTML = `
          <div class="cat-name">${cat.name}</div>
          <div class="cat-count">${cat.count.toLocaleString()}</div>
          <div class="cat-pct" style="color: ${cat.color}">${cat.pct}% of valid visits</div>
        `;
        catContainer.appendChild(div);
      });
    } catch (err) {
      console.error('Failed to load distribution:', err);
    }
  }

  // =========================================================================
  // 4 & 5. Sampling Lab & Estimation (Section 4 & 5)
  // =========================================================================
  async function runSamplingLab() {
    try {
      const payload = {
        method: state.method,
        n: state.sampleSize,
        seed: state.seed,
        strata_col: state.groupBy
      };

      const res = await fetch('/api/sample', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      // Update Sampling Lab Metrics
      const methodLabels = {
        baseline: 'Notebook Baseline Sample (n=100)',
        srs: 'Simple Random Sampling (SRS)',
        systematic: 'Systematic Sampling (Interval k = N/n)',
        stratified: 'Stratified Sampling (Proportional)'
      };
      document.getElementById('lab-method-val').textContent = methodLabels[data.method] || data.method;
      document.getElementById('lab-n-val').textContent = data.sample_size;
      document.getElementById('lab-mean-val').textContent = `${data.sample_mean.toFixed(2)} min`;
      document.getElementById('lab-median-val').textContent = `${data.sample_median.toFixed(2)} min`;
      document.getElementById('lab-std-val').textContent = `${data.sample_std.toFixed(2)} min`;
      document.getElementById('lab-se-val').textContent = `${data.standard_error.toFixed(3)} min`;
      document.getElementById('lab-diff-val').textContent = `${data.diff_from_pop_mean >= 0 ? '+' : ''}${data.diff_from_pop_mean.toFixed(3)} min`;
      document.getElementById('lab-abs-err-val').textContent = `${data.absolute_error.toFixed(3)} min`;
      document.getElementById('lab-rel-err-val').textContent = `${data.relative_error_pct.toFixed(2)}%`;

      // Update Section 5: Estimation Card
      document.getElementById('est-ci-lower').textContent = `${data.ci_mean[0].toFixed(2)} min`;
      document.getElementById('est-ci-upper').textContent = `${data.ci_mean[1].toFixed(2)} min`;
      document.getElementById('est-point-val').textContent = `Point Estimate: ${data.sample_mean.toFixed(2)} min`;

      // Update Sample Table
      document.getElementById('sample-count-badge').textContent = data.records.length;
      const tbody = document.getElementById('sample-records-tbody');
      tbody.innerHTML = '';
      data.records.forEach((row, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${i + 1}</strong></td>
          <td class="fw-bold ${row.WAITTIME > 60 ? 'text-rose' : 'text-teal'}">${row.WAITTIME} min</td>
          <td>${row.AGE} yrs</td>
          <td>${row.SEX_LABEL}</td>
          <td>${row.DAY_OF_WEEK}</td>
          <td>${row.TRIAGE_CATEGORY}</td>
          <td>${row.ARRIVAL_MODE}</td>
        `;
        tbody.appendChild(tr);
      });

      // Synchronize Executive KPI cards if sample updated
      loadOverview();
    } catch (err) {
      console.error('Failed to run sampling lab:', err);
    }
  }

  // =========================================================================
  // 6. Central Limit Theorem (Section 6)
  // =========================================================================
  async function loadCLT(n = 30) {
    try {
      const res = await fetch(`/api/clt?n=${n}&reps=1000`);
      const data = await res.json();

      document.getElementById('clt-cur-n').textContent = data.n;
      document.getElementById('clt-mean-val').textContent = `${data.empirical_mean.toFixed(2)} min`;
      document.getElementById('clt-emp-se').textContent = `${data.empirical_std.toFixed(2)} min`;
      document.getElementById('clt-theor-se').textContent = `${data.theoretical_se.toFixed(2)} min`;

      // Left Chart: Individual Positive Skew
      const indTrace = {
        x: data.individual_sample,
        type: 'histogram',
        marker: { color: '#F43F5E', opacity: 0.8 },
        autobinx: true,
        name: 'Individual Visits'
      };
      const indLayout = {
        ...plotlyLayoutDefaults,
        xaxis: { title: 'Individual Waiting Time (min)', gridcolor: '#F1F5F9' },
        yaxis: { title: 'Frequency', gridcolor: '#F1F5F9' }
      };
      Plotly.newPlot('chart-clt-individual', [indTrace], indLayout, plotlyConfig);

      // Right Chart: Sampling Distribution of Means
      const meansTrace = {
        x: data.sample_means_bins,
        y: data.sample_means_counts,
        type: 'bar',
        marker: { color: '#10B981', opacity: 0.85, line: { color: '#059669', width: 1 } },
        name: 'Sample Means'
      };
      const meansLayout = {
        ...plotlyLayoutDefaults,
        xaxis: { title: `Sample Means x̄ (Repeated n = ${data.n})`, gridcolor: '#F1F5F9' },
        yaxis: { title: 'Frequency (out of 1,000 draws)', gridcolor: '#F1F5F9' },
        shapes: [
          {
            type: 'line', x0: data.pop_mean, x1: data.pop_mean, y0: 0, y1: Math.max(...data.sample_means_counts) * 1.05,
            line: { color: '#0F172A', width: 2, dash: 'dash' }
          }
        ]
      };
      Plotly.newPlot('chart-clt-means', [meansTrace], meansLayout, plotlyConfig);
    } catch (err) {
      console.error('Failed to load CLT:', err);
    }
  }

  // =========================================================================
  // 7. Bootstrap Analysis (Section 7)
  // =========================================================================
  async function loadBootstrap() {
    try {
      const payload = {
        stat: state.bootStat,
        iterations: state.bootIters
      };

      const res = await fetch('/api/bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      document.getElementById('boot-status-badge').textContent = `${data.iterations.toLocaleString()} Iterations (${data.stat_type.toUpperCase()})`;
      document.getElementById('boot-result-annotation').innerHTML = `
        Bootstrap Point Estimate: <strong>${data.point_estimate.toFixed(2)} min</strong> |
        95% Bootstrap Percentile Confidence Interval: <strong>[${data.ci_lower.toFixed(2)} min, ${data.ci_upper.toFixed(2)} min]</strong> |
        Bootstrap SE: <strong>${data.standard_error.toFixed(3)} min</strong>
      `;

      // Bootstrap Distribution Chart with shaded 95% interval
      const bootTrace = {
        x: data.bins,
        y: data.counts,
        type: 'bar',
        marker: {
          color: data.bins.map(b => (b >= data.ci_lower && b <= data.ci_upper) ? '#4F46E5' : '#CBD5E1'),
          line: { color: '#312E81', width: 0.5 }
        },
        name: 'Bootstrap Estimates',
        hovertemplate: 'Estimate: %{x:.2f} min<br>Count: %{y}<extra></extra>'
      };

      const bootLayout = {
        ...plotlyLayoutDefaults,
        xaxis: { title: `Bootstrap Distribution of ${data.stat_type === 'median' ? 'Median' : 'Mean'} (Minutes)` },
        yaxis: { title: 'Frequency', gridcolor: '#F1F5F9' },
        shapes: [
          {
            type: 'line', x0: data.point_estimate, x1: data.point_estimate, y0: 0, y1: Math.max(...data.counts) * 1.05,
            line: { color: '#0D9488', width: 2.5 }
          },
          {
            type: 'line', x0: data.ci_lower, x1: data.ci_lower, y0: 0, y1: Math.max(...data.counts) * 0.9,
            line: { color: '#E11D48', width: 2, dash: 'dash' }
          },
          {
            type: 'line', x0: data.ci_upper, x1: data.ci_upper, y0: 0, y1: Math.max(...data.counts) * 0.9,
            line: { color: '#E11D48', width: 2, dash: 'dash' }
          }
        ],
        annotations: [
          {
            x: data.point_estimate, y: Math.max(...data.counts) * 0.98, text: `Est: ${data.point_estimate}m`,
            showarrow: true, arrowhead: 2, ax: 0, ay: -25,
            font: { color: '#0D9488', weight: 700 }
          },
          {
            x: data.ci_lower, y: Math.max(...data.counts) * 0.7, text: `2.5%: ${data.ci_lower}m`,
            showarrow: true, arrowhead: 2, ax: -35, ay: -20,
            font: { color: '#E11D48' }
          },
          {
            x: data.ci_upper, y: Math.max(...data.counts) * 0.7, text: `97.5%: ${data.ci_upper}m`,
            showarrow: true, arrowhead: 2, ax: 35, ay: -20,
            font: { color: '#E11D48' }
          }
        ]
      };
      Plotly.newPlot('chart-bootstrap', [bootTrace], bootLayout, plotlyConfig);
    } catch (err) {
      console.error('Failed to load bootstrap:', err);
    }
  }

  // =========================================================================
  // 8. Long-Wait Analysis (Section 8)
  // =========================================================================
  async function loadLongWait(threshold = 60) {
    try {
      const res = await fetch(`/api/long_wait?threshold=${threshold}`);
      const data = await res.json();

      document.querySelectorAll('.threshold-insert').forEach(el => el.textContent = data.threshold);
      document.getElementById('long-wait-pct').textContent = `${data.population.percentage}%`;
      document.getElementById('long-wait-count').textContent = data.population.above_count.toLocaleString();
      document.getElementById('long-wait-total').textContent = data.population.total.toLocaleString();
      document.getElementById('long-wait-wilson').textContent = `[${ (data.sample.wilson_ci[0]*100).toFixed(1) }%, ${ (data.sample.wilson_ci[1]*100).toFixed(1) }%]`;

      // Donut Chart
      const donutData = [{
        values: [data.population.below_count, data.population.above_count],
        labels: [`≤ ${data.threshold} min (Normal)`, `> ${data.threshold} min (Delayed)`],
        type: 'pie',
        hole: 0.55,
        marker: { colors: ['#10B981', '#E11D48'] },
        textinfo: 'label+percent',
        hoverinfo: 'label+value+percent'
      }];

      const donutLayout = {
        ...plotlyLayoutDefaults,
        showlegend: true,
        legend: { orientation: 'h', y: -0.15 }
      };
      Plotly.newPlot('chart-long-wait-donut', donutData, donutLayout, plotlyConfig);
    } catch (err) {
      console.error('Failed to load long wait:', err);
    }
  }

  // =========================================================================
  // 9. Group Comparison (Section 9)
  // =========================================================================
  async function loadGroupComparison(groupBy = 'SEX_LABEL') {
    try {
      const res = await fetch(`/api/groups?group_by=${groupBy}`);
      const data = await res.json();

      // Populate Table
      const tbody = document.getElementById('group-stats-tbody');
      tbody.innerHTML = '';
      data.groups.forEach(g => {
        const iqr = (g.q3 - g.q1).toFixed(1);
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${g.group}</strong></td>
          <td>${g.count.toLocaleString()}</td>
          <td class="fw-bold">${g.mean.toFixed(2)} min</td>
          <td>${g.median.toFixed(1)} min</td>
          <td>${g.std.toFixed(2)} min</td>
          <td>${iqr} min</td>
        `;
        tbody.appendChild(tr);
      });

      // Bar Chart: Mean vs Median
      const categories = data.groups.map(g => g.group);
      const means = data.groups.map(g => g.mean);
      const medians = data.groups.map(g => g.median);

      const meanBar = {
        x: categories,
        y: means,
        name: 'Mean Wait Time',
        type: 'bar',
        marker: { color: '#0284C7' }
      };
      const medianBar = {
        x: categories,
        y: medians,
        name: 'Median Wait Time',
        type: 'bar',
        marker: { color: '#0D9488' }
      };

      const barLayout = {
        ...plotlyLayoutDefaults,
        barmode: 'group',
        xaxis: { title: data.group_label },
        yaxis: { title: 'Minutes' },
        legend: { orientation: 'h', y: 1.15 }
      };
      Plotly.newPlot('chart-group-bar', [meanBar, medianBar], barLayout, plotlyConfig);

      // Box Plot Summary
      const groupBoxes = data.groups.map(g => ({
        type: 'box',
        name: g.group,
        q1: [g.q1],
        median: [g.median],
        q3: [g.q3],
        lowerfence: [Math.max(0, g.q1 - 1.5 * (g.q3 - g.q1))],
        upperfence: [g.q3 + 1.5 * (g.q3 - g.q1)],
        boxpoints: false
      }));

      const boxLayout = {
        ...plotlyLayoutDefaults,
        xaxis: { title: data.group_label },
        yaxis: { title: 'Waiting Time (Minutes, Interquartile)' },
        showlegend: false
      };
      Plotly.newPlot('chart-group-box', groupBoxes, boxLayout, plotlyConfig);
    } catch (err) {
      console.error('Failed to load group comparison:', err);
    }
  }

  // =========================================================================
  // 10. Sample Size vs Accuracy Error Curve (Section 10)
  // =========================================================================
  async function loadErrorCurve() {
    try {
      const res = await fetch('/api/sample_size_curve');
      const data = await res.json();

      const sizes = data.curve.map(c => c.sample_size);
      const empErrors = data.curve.map(c => c.empirical_abs_error);
      const theorErrors = data.curve.map(c => c.theoretical_abs_error);

      const traceEmpirical = {
        x: sizes,
        y: empErrors,
        mode: 'lines+markers',
        name: 'Empirical Absolute Error',
        line: { color: '#0284C7', width: 3 },
        marker: { size: 8, color: '#0F172A' }
      };

      const traceTheoretical = {
        x: sizes,
        y: theorErrors,
        mode: 'lines',
        name: 'Theoretical Expected Error (~1/√n)',
        line: { color: '#E11D48', width: 2, dash: 'dash' }
      };

      const layout = {
        ...plotlyLayoutDefaults,
        xaxis: { title: 'Sample Size (n)', gridcolor: '#F1F5F9' },
        yaxis: { title: 'Mean Absolute Error |x̄ - μ| (Minutes)', gridcolor: '#F1F5F9' },
        legend: { orientation: 'h', y: 1.15 }
      };
      Plotly.newPlot('chart-error-curve', [traceEmpirical, traceTheoretical], layout, plotlyConfig);
    } catch (err) {
      console.error('Failed to load error curve:', err);
    }
  }

  // =========================================================================
  // 15. Data Explorer (Section 15)
  // =========================================================================
  async function loadDataExplorer() {
    try {
      const params = new URLSearchParams({
        page: state.dataPage,
        page_size: state.dataPageSize,
        search: state.dataSearch,
        sort_by: state.dataSortBy,
        sort_order: state.dataSortOrder
      });

      const res = await fetch(`/api/data?${params.toString()}`);
      const data = await res.json();

      // Table rows
      const tbody = document.getElementById('explorer-tbody');
      tbody.innerHTML = '';
      data.data.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="fw-bold ${row.WAITTIME > 60 ? 'text-rose' : 'text-teal'}">${row.WAITTIME} min</td>
          <td>${row.AGE} yrs</td>
          <td>${row.SEX_LABEL}</td>
          <td>${row.DAY_OF_WEEK}</td>
          <td>${row.TRIAGE_CATEGORY}</td>
          <td>${row.ARRIVAL_MODE}</td>
          <td>${row.AGE_GROUP}</td>
          <td>${row.MONTH}</td>
        `;
        tbody.appendChild(tr);
      });

      // Pagination
      const start = (data.page - 1) * data.page_size + 1;
      const end = Math.min(data.page * data.page_size, data.total_rows);
      document.getElementById('pagination-info').textContent = `Showing ${start.toLocaleString()} to ${end.toLocaleString()} of ${data.total_rows.toLocaleString()} records`;
      document.getElementById('page-display').textContent = `Page ${data.page} of ${data.total_pages}`;

      document.getElementById('btn-prev-page').disabled = (data.page <= 1);
      document.getElementById('btn-next-page').disabled = (data.page >= data.total_pages);
    } catch (err) {
      console.error('Failed to load data explorer:', err);
    }
  }

  // =========================================================================
  // Event Listeners Wiring
  // =========================================================================
  function initEventListeners() {
    // Sidebar Controls
    const sidebar = document.getElementById('global-sidebar');
    document.getElementById('btn-open-sidebar')?.addEventListener('click', () => {
      sidebar.classList.toggle('open');
    });
    document.getElementById('btn-close-sidebar')?.addEventListener('click', () => {
      sidebar.classList.remove('open');
    });

    // Modal controls
    const modal = document.getElementById('project-modal');
    document.getElementById('btn-project-info')?.addEventListener('click', () => {
      modal.classList.add('active');
    });
    document.getElementById('btn-close-modal')?.addEventListener('click', () => {
      modal.classList.remove('active');
    });
    document.getElementById('btn-modal-ok')?.addEventListener('click', () => {
      modal.classList.remove('active');
    });

    // Sliders & Forms
    const sampleSizeSlider = document.getElementById('ctrl-sample-size');
    sampleSizeSlider.addEventListener('input', (e) => {
      state.sampleSize = parseInt(e.target.value);
      document.getElementById('val-sample-size').textContent = state.sampleSize;
    });

    const thresholdSlider = document.getElementById('ctrl-threshold');
    thresholdSlider.addEventListener('input', (e) => {
      state.threshold = parseInt(e.target.value);
      document.getElementById('val-threshold').textContent = `${state.threshold} min`;
      document.getElementById('long-wait-slider').value = state.threshold;
      document.getElementById('long-wait-threshold-lbl').textContent = `${state.threshold} min`;
      loadLongWait(state.threshold);
    });

    const longWaitSectionSlider = document.getElementById('long-wait-slider');
    longWaitSectionSlider.addEventListener('input', (e) => {
      state.threshold = parseInt(e.target.value);
      document.getElementById('long-wait-threshold-lbl').textContent = `${state.threshold} min`;
      document.getElementById('val-threshold').textContent = `${state.threshold} min`;
      document.getElementById('ctrl-threshold').value = state.threshold;
      loadLongWait(state.threshold);
    });

    document.getElementById('btn-dice-seed')?.addEventListener('click', () => {
      const rand = Math.floor(Math.random() * 10000);
      document.getElementById('ctrl-seed').value = rand;
      state.seed = rand;
    });

    document.getElementById('ctrl-method').addEventListener('change', (e) => {
      state.method = e.target.value;
    });

    document.getElementById('ctrl-bootstrap-iters').addEventListener('change', (e) => {
      state.bootIters = parseInt(e.target.value);
      document.getElementById('boot-iters-select').value = state.bootIters;
    });

    document.getElementById('ctrl-group-var').addEventListener('change', (e) => {
      state.groupBy = e.target.value;
      document.getElementById('group-comparison-select').value = state.groupBy;
      loadGroupComparison(state.groupBy);
    });

    document.getElementById('group-comparison-select').addEventListener('change', (e) => {
      state.groupBy = e.target.value;
      document.getElementById('ctrl-group-var').value = state.groupBy;
      loadGroupComparison(state.groupBy);
    });

    // Run Sampling Action
    document.getElementById('btn-apply-sampling')?.addEventListener('click', () => {
      state.seed = parseInt(document.getElementById('ctrl-seed').value) || 42;
      runSamplingLab();
      loadBootstrap();
    });
    document.getElementById('btn-run-lab')?.addEventListener('click', () => {
      state.seed = parseInt(document.getElementById('ctrl-seed').value) || 42;
      runSamplingLab();
      loadBootstrap();
    });

    // Reset Analysis Action
    const handleReset = async () => {
      await fetch('/api/reset', { method: 'POST' });
      state.method = 'baseline';
      state.sampleSize = 100;
      state.seed = 42;
      document.getElementById('ctrl-method').value = 'baseline';
      document.getElementById('ctrl-sample-size').value = 100;
      document.getElementById('val-sample-size').textContent = 100;
      document.getElementById('ctrl-seed').value = 42;
      runSamplingLab();
      loadBootstrap();
      loadOverview();
    };
    document.getElementById('btn-reset-analysis')?.addEventListener('click', handleReset);
    document.getElementById('btn-reset-lab')?.addEventListener('click', handleReset);

    // Histogram Bins slider
    document.getElementById('hist-bins-input')?.addEventListener('input', (e) => {
      const bins = parseInt(e.target.value);
      document.getElementById('hist-bins-val').textContent = bins;
      loadDistribution(bins);
    });

    // CLT sample size buttons
    document.querySelectorAll('.clt-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.clt-btn').forEach(b => {
          b.classList.remove('btn-primary');
          b.classList.add('btn-outline');
        });
        btn.classList.add('btn-primary');
        btn.classList.remove('btn-outline');
        state.cltN = parseInt(btn.getAttribute('data-n'));
        loadCLT(state.cltN);
      });
    });

    document.getElementById('btn-re-simulate-clt')?.addEventListener('click', () => {
      loadCLT(state.cltN);
    });

    // Bootstrap controls
    document.getElementById('boot-stat-select')?.addEventListener('change', (e) => {
      state.bootStat = e.target.value;
    });
    document.getElementById('boot-iters-select')?.addEventListener('change', (e) => {
      state.bootIters = parseInt(e.target.value);
      document.getElementById('ctrl-bootstrap-iters').value = state.bootIters;
    });
    document.getElementById('btn-run-bootstrap')?.addEventListener('click', () => {
      loadBootstrap();
    });

    // Data Explorer Search & Pagination
    let searchDebounce = null;
    document.getElementById('explorer-search')?.addEventListener('input', (e) => {
      clearTimeout(searchDebounce);
      searchDebounce = setTimeout(() => {
        state.dataSearch = e.target.value.trim();
        state.dataPage = 1;
        loadDataExplorer();
      }, 300);
    });

    document.getElementById('explorer-page-size')?.addEventListener('change', (e) => {
      state.dataPageSize = parseInt(e.target.value);
      state.dataPage = 1;
      loadDataExplorer();
    });

    document.getElementById('btn-prev-page')?.addEventListener('click', () => {
      if (state.dataPage > 1) {
        state.dataPage--;
        loadDataExplorer();
      }
    });

    document.getElementById('btn-next-page')?.addEventListener('click', () => {
      state.dataPage++;
      loadDataExplorer();
    });

    // Column sorting
    document.querySelectorAll('#explorer-data-table th[data-col]').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.getAttribute('data-col');
        if (state.dataSortBy === col) {
          state.dataSortOrder = state.dataSortOrder === 'asc' ? 'desc' : 'asc';
        } else {
          state.dataSortBy = col;
          state.dataSortOrder = 'asc';
        }
        loadDataExplorer();
      });
    });
  }
});
