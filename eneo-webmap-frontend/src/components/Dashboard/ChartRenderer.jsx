/**
 * ChartRenderer.jsx
 * =================
 * Rendu dynamique d'un graphique selon le type et les données agrégées.
 * Utilise Recharts. Export PNG via html2canvas.
 *
 * Props :
 *   chartType      : 'pie' | 'donut' | 'bar' | 'bar_horizontal' | 'histogram' | 'line' | 'treemap' | 'grouped_bar'
 *   data           : AggregationResult (tableau [{ label, count, percent }] ou { labels, series })
 *   colorScheme    : 'default' | 'rainbow' | 'warm' | 'cool' | 'monochrome'
 *   title          : string (optionnel)
 *   height         : number (px, défaut 280)
 */

import { useRef } from 'react'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  LineChart, Line,
  Treemap,
} from 'recharts'
import { COLOR_SCHEMES } from '../../services/dashboardService'

// ─── Tooltip personnalisé ────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'rgba(13,27,42,0.95)',
      border:     '1px solid rgba(0,170,221,0.3)',
      borderRadius: 6,
      padding:    '8px 12px',
      fontSize:   13,
      color:      '#e2e8f0',
    }}>
      <p style={{ margin: 0, fontWeight: 600 }}>{label || payload[0]?.name}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: '2px 0', color: p.color || '#00aadd' }}>
          {p.name !== (label || payload[0]?.name) ? `${p.name}: ` : ''}
          <strong>{p.value}</strong>
          {p.payload?.percent !== undefined ? ` (${p.payload.percent}%)` : ''}
        </p>
      ))}
    </div>
  )
}

// ─── Label camembert ────────────────────────────────────────────────────
const PieLabel = ({ cx, cy, midAngle, outerRadius, percent, name }) => {
  if (percent < 0.05) return null
  const RADIAN = Math.PI / 180
  const r = outerRadius + 24
  const x = cx + r * Math.cos(-midAngle * RADIAN)
  const y = cy + r * Math.sin(-midAngle * RADIAN)
  return (
    <text x={x} y={y} fill="#e2e8f0" textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central" fontSize={11}>
      {name} ({(percent * 100).toFixed(1)}%)
    </text>
  )
}

// ─── Treemap label ────────────────────────────────────────────────────────
const TreemapContent = ({ x, y, width, height, name, count }) => {
  if (width < 40 || height < 20) return null
  return (
    <g>
      <text x={x + width / 2} y={y + height / 2 - 6}
        textAnchor="middle" fill="#fff" fontSize={Math.min(12, width / 8)}>
        {name}
      </text>
      <text x={x + width / 2} y={y + height / 2 + 10}
        textAnchor="middle" fill="rgba(255,255,255,0.7)" fontSize={10}>
        {count}
      </text>
    </g>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────
export default function ChartRenderer({
  chartType,
  data,
  colorScheme = 'default',
  height = 280,
}) {
  const colors = COLOR_SCHEMES[colorScheme] || COLOR_SCHEMES.default

  const commonProps = {
    margin: { top: 10, right: 20, left: 0, bottom: 5 },
  }

  const axisStyle = {
    tick:      { fill: '#94a3b8', fontSize: 11 },
    axisLine:  { stroke: 'rgba(148,163,184,0.2)' },
    tickLine:  false,
  }

  const gridStyle = {
    stroke:          'rgba(148,163,184,0.1)',
    strokeDasharray: '3 3',
  }

  // ── Pie / Donut ──────────────────────────────────────────────────────────
  if (chartType === 'pie' || chartType === 'donut') {
    const isDonut = chartType === 'donut'
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart {...commonProps}>
          <Pie
            data={data}
            dataKey="count"
            nameKey="label"
            cx="50%"
            cy="50%"
            outerRadius={isDonut ? 95 : 100}
            innerRadius={isDonut ? 55 : 0}
            labelLine={false}
            label={!isDonut ? PieLabel : false}
          >
            {data.map((entry, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          {isDonut && (
            <Legend
              iconType="circle"
              iconSize={10}
              formatter={v => <span style={{ color: '#cbd5e1', fontSize: 12 }}>{v}</span>}
            />
          )}
        </PieChart>
      </ResponsiveContainer>
    )
  }

  // ── Bar vertical ─────────────────────────────────────────────────────────
  if (chartType === 'bar' || chartType === 'histogram') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} {...commonProps}>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="label" {...axisStyle}
            interval={data.length > 10 ? Math.floor(data.length / 8) : 0}
            angle={data.length > 8 ? -35 : 0}
            textAnchor={data.length > 8 ? 'end' : 'middle'}
            height={data.length > 8 ? 55 : 30}
          />
          <YAxis {...axisStyle} />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // ── Bar horizontal ───────────────────────────────────────────────────────
  if (chartType === 'bar_horizontal') {
    return (
      <ResponsiveContainer width="100%" height={Math.max(height, data.length * 32 + 40)}>
        <BarChart data={data} layout="vertical" {...commonProps} margin={{ ...commonProps.margin, left: 10 }}>
          <CartesianGrid {...gridStyle} horizontal={false} />
          <XAxis type="number" {...axisStyle} />
          <YAxis type="category" dataKey="label" {...axisStyle} width={140}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={colors[i % colors.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    )
  }

  // ── Line ─────────────────────────────────────────────────────────────────
  if (chartType === 'line') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} {...commonProps}>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="label" {...axisStyle} />
          <YAxis {...axisStyle} />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="count"
            stroke={colors[0]}
            strokeWidth={2.5}
            dot={{ fill: colors[0], r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    )
  }

  // ── Treemap ───────────────────────────────────────────────────────────────
  if (chartType === 'treemap') {
    const treeData = data.map((d, i) => ({
      ...d,
      name:  d.label,
      size:  d.count,
      fill:  colors[i % colors.length],
    }))
    return (
      <ResponsiveContainer width="100%" height={height}>
        <Treemap
          data={treeData}
          dataKey="size"
          content={<TreemapContent />}
        >
          {treeData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Treemap>
      </ResponsiveContainer>
    )
  }

  // ── Grouped Bar (2 attributs croisés) ────────────────────────────────────
  if (chartType === 'grouped_bar' && data?.labels) {
    const { labels, series } = data
    const chartData = labels.map((label, i) => {
      const row = { label }
      for (const s of series) row[s.name] = s.data[i]
      return row
    })
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} {...commonProps}>
          <CartesianGrid {...gridStyle} />
          <XAxis dataKey="label" {...axisStyle}
            interval={labels.length > 8 ? Math.floor(labels.length / 6) : 0}
            angle={labels.length > 8 ? -30 : 0}
            textAnchor={labels.length > 8 ? 'end' : 'middle'}
            height={labels.length > 8 ? 50 : 30}
          />
          <YAxis {...axisStyle} />
          <Tooltip content={<CustomTooltip />} />
          <Legend formatter={v => <span style={{ color: '#cbd5e1', fontSize: 12 }}>{v}</span>} />
          {series.map((s, i) => (
            <Bar key={s.name} dataKey={s.name} fill={colors[i % colors.length]} radius={[3, 3, 0, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
      height, color: '#64748b', fontSize: 13 }}>
      Type de graphique non supporté : {chartType}
    </div>
  )
}
