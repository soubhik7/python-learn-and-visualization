import numpy as np
import plotly.graph_objects as go
from plotly.subplots import make_subplots

# -----------------------------
# Lorenz System Definition
# -----------------------------
def lorenz(x, y, z, sigma=10, rho=28, beta=8/3):
    dx = sigma * (y - x)
    dy = x * (rho - z) - y
    dz = x * y - beta * z
    return dx, dy, dz

# -----------------------------
# Numerical Simulation
# -----------------------------
def simulate_lorenz(dt=0.01, steps=10000):
    xs = np.zeros(steps)
    ys = np.zeros(steps)
    zs = np.zeros(steps)

    # Initial condition
    xs[0], ys[0], zs[0] = (0., 1., 1.05)

    for i in range(steps - 1):
        dx, dy, dz = lorenz(xs[i], ys[i], zs[i])
        xs[i + 1] = xs[i] + dx * dt
        ys[i + 1] = ys[i] + dy * dt
        zs[i + 1] = zs[i] + dz * dt

    return xs, ys, zs

# Run simulation
x, y, z = simulate_lorenz()

# -----------------------------
# Create Subplots
# -----------------------------
fig = make_subplots(
    rows=2, cols=2,
    specs=[[{'type': 'scene'}, {'type': 'xy'}],
           [{'type': 'xy'}, {'type': 'xy'}]],
    subplot_titles=("3D Lorenz Attractor", "X vs Time", "Y vs Time", "Z vs Time")
)

# -----------------------------
# 3D Plot
# -----------------------------
fig.add_trace(
    go.Scatter3d(
        x=x, y=y, z=z,
        mode='lines',
        line=dict(width=2),
        name='Lorenz Attractor'
    ),
    row=1, col=1
)

# -----------------------------
# Time Series Plots
# -----------------------------
t = np.arange(len(x))

fig.add_trace(go.Scatter(x=t, y=x, mode='lines', name='X'), row=1, col=2)
fig.add_trace(go.Scatter(x=t, y=y, mode='lines', name='Y'), row=2, col=1)
fig.add_trace(go.Scatter(x=t, y=z, mode='lines', name='Z'), row=2, col=2)

# -----------------------------
# Layout
# -----------------------------
fig.update_layout(
    height=800,
    width=1000,
    title="Lorenz System Visualization (Chaos Theory)",
    showlegend=False
)

fig.show()