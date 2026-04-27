import sys
import os
import json
import base64
import io
import traceback


def capture_and_run(script_path):
    captured = {
        'stdout': '',
        'stderr': '',
        'figures': [],
        'error': None
    }

    # Force matplotlib non-interactive backend before any user imports
    os.environ['MPLBACKEND'] = 'Agg'

    matplotlib_patched = False
    try:
        import matplotlib
        matplotlib.use('Agg')
        import matplotlib.pyplot as plt

        def patched_show(*args, **kwargs):
            for num in plt.get_fignums():
                fig = plt.figure(num)
                buf = io.BytesIO()
                fig.savefig(buf, format='png', bbox_inches='tight', dpi=150)
                buf.seek(0)
                captured['figures'].append({
                    'type': 'image/png',
                    'data': base64.b64encode(buf.read()).decode('utf-8')
                })
            plt.close('all')

        plt.show = patched_show
        matplotlib_patched = True
    except ImportError:
        pass

    try:
        import plotly.basedatatypes as _pb
        import plotly.io as _pio

        def patched_plotly_show(self, *args, **kwargs):
            # Try PNG export first (requires kaleido package)
            try:
                img_bytes = _pio.to_image(self, format='png', scale=2)
                captured['figures'].append({
                    'type': 'image/png',
                    'data': base64.b64encode(img_bytes).decode('utf-8')
                })
                return
            except Exception:
                pass
            # Fallback: standalone HTML for srcdoc iframe (CDN version is much smaller)
            html = _pio.to_html(
                self, full_html=True, include_plotlyjs='cdn',
                config={'responsive': True}
            )
            captured['figures'].append({'type': 'plotly-html', 'data': html})

        _pb.BaseFigure.show = patched_plotly_show
    except ImportError:
        pass

    captured_stdout = io.StringIO()
    captured_stderr = io.StringIO()
    old_stdout, old_stderr = sys.stdout, sys.stderr
    sys.stdout = captured_stdout
    sys.stderr = captured_stderr

    try:
        with open(script_path, 'r', encoding='utf-8') as f:
            code = f.read()
        script_dir = os.path.dirname(os.path.abspath(script_path))
        if script_dir not in sys.path:
            sys.path.insert(0, script_dir)
        exec(compile(code, script_path, 'exec'), {
            '__name__': '__main__',
            '__file__': script_path,
            '__doc__': None,
            '__package__': None,
        })
    except SystemExit:
        pass
    except Exception:
        captured['error'] = traceback.format_exc()
    finally:
        captured['stdout'] = captured_stdout.getvalue()
        captured['stderr'] = captured_stderr.getvalue()
        sys.stdout = old_stdout
        sys.stderr = old_stderr

    # Capture any matplotlib figures not explicitly shown via plt.show()
    if matplotlib_patched:
        try:
            import matplotlib.pyplot as plt
            if plt.get_fignums():
                for num in plt.get_fignums():
                    fig = plt.figure(num)
                    buf = io.BytesIO()
                    fig.savefig(buf, format='png', bbox_inches='tight', dpi=150)
                    buf.seek(0)
                    captured['figures'].append({
                        'type': 'image/png',
                        'data': base64.b64encode(buf.read()).decode('utf-8')
                    })
                plt.close('all')
        except Exception:
            pass

    return captured


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.__stdout__.write(json.dumps({
            'error': 'No script path provided',
            'figures': [], 'stdout': '', 'stderr': ''
        }) + '\n')
        sys.exit(1)

    result = capture_and_run(sys.argv[1])
    sys.__stdout__.write(json.dumps(result) + '\n')
