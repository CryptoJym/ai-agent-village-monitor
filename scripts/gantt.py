"""
Generates a 6-week MVP Gantt chart as PNG and SVG.

Usage:
  pip install plotly kaleido pandas
  python3 scripts/gantt.py
"""

import plotly.graph_objects as go
import pandas as pd

# Define the tasks data
tasks_data = [
    dict(Task="Village Render", Start_Week=1, Duration=1, Type="Frontend", Description="Phaser.js setup"),
    dict(Task="RPG Dialogue", Start_Week=2, Duration=1, Type="Frontend", Description="UI panel system"),
    dict(Task="MCP Integration", Start_Week=3, Duration=1, Type="Backend", Description="Real agents"),
    dict(Task="Bug Bot System", Start_Week=4, Duration=1, Type="Backend", Description="Probot app"),
    dict(Task="Performance", Start_Week=5, Duration=1, Type="DevOps", Description="Optimization"),
    dict(Task="Test & Launch", Start_Week=6, Duration=1, Type="Testing", Description="QA & deploy"),
]

# Create DataFrame
df = pd.DataFrame(tasks_data)

# Color mapping using specified brand colors
color_map = {
    "Frontend": "#2E8B57",   # Sea green
    "Backend": "#1FB8CD",    # Strong cyan
    "DevOps": "#D2BA4C",     # Moderate yellow (orange-ish)
    "Testing": "#944454",    # Pink-red (purple-ish)
}

# Create the figure
fig = go.Figure()

# Add task bars spanning their duration
for _, row in df.iterrows():
    fig.add_trace(go.Bar(
        x=[row['Duration']],
        y=[row['Task']],
        orientation='h',
        marker_color=color_map[row['Type']],
        name=row['Type'],
        legendgroup=row['Type'],
        showlegend=True,
        width=0.5,
        base=row['Start_Week'] - 0.5
    ))

# Remove duplicate legend entries
legend_added = set()
for trace in fig.data:
    if trace.name in legend_added:
        trace.showlegend = False
    else:
        legend_added.add(trace.name)

# Add milestone diamonds
milestones = [
    dict(week=2.5, task="RPG Dialogue", label="Core UI Done"),
    dict(week=4.5, task="Bug Bot System", label="Full Integr'n"),
    dict(week=6.5, task="Test & Launch", label="MVP Ready"),
]

task_positions = {task: i for i, task in enumerate(df['Task'])}

for milestone in milestones:
    y_pos = task_positions[milestone['task']]
    fig.add_trace(go.Scatter(
        x=[milestone['week']],
        y=[y_pos],
        mode='markers+text',
        marker=dict(
            symbol='diamond',
            size=12,
            color='#DB4545',
            line=dict(color='black', width=1)
        ),
        text=milestone['label'],
        textposition="top center",
        textfont=dict(size=10, color='black'),
        showlegend=False,
        name='Milestone'
    ))

# Add dependency arrows
for i in range(len(df) - 1):
    current_task = df.iloc[i]
    next_task = df.iloc[i + 1]
    fig.add_annotation(
        x=next_task['Start_Week'] - 0.5,
        y=i + 1,
        ax=current_task['Start_Week'] + current_task['Duration'] - 0.5,
        ay=i,
        arrowhead=2,
        arrowsize=1,
        arrowwidth=2,
        arrowcolor='gray',
        opacity=0.7
    )

# Layout
fig.update_layout(
    title="6-Week MVP Development Plan",
    xaxis=dict(
        title="Timeline",
        tickmode='array',
        tickvals=[1, 2, 3, 4, 5, 6],
        ticktext=['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'],
        range=[0.5, 7]
    ),
    yaxis=dict(
        title="Dev Tracks",
        categoryorder="array",
        categoryarray=list(reversed(df['Task'].tolist()))
    ),
    barmode='overlay',
    legend=dict(
        orientation='h', yanchor='bottom', y=1.05, xanchor='center', x=0.5
    )
)

fig.update_traces(cliponaxis=False)

# Save the chart
fig.write_image("gantt_chart.png")
fig.write_image("gantt_chart.svg", format="svg")

print("Saved gantt_chart.png and gantt_chart.svg")

