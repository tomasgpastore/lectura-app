#!/usr/bin/env python3
"""
Script to display the agent graph visually.
"""

import sys
import os

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.pipeline.outbound.agent import OutboundAgent


def show_agent_graph():
    """Display the agent graph using IPython display."""
    # Import here after checking if we're in an IPython environment
    try:
        from IPython.display import Image, display
        in_ipython = True
    except ImportError:
        in_ipython = False
    
    print("Creating agent instance...")
    agent = OutboundAgent()
    
    # Build a sample graph
    print("Building graph...")
    graph = agent._build_graph("sample_user", "sample_course", "sample_snapshot")
    compiled_graph = graph.compile()
    
    print("Generating visualization...")
    try:
        # Generate the image data
        image_data = compiled_graph.get_graph().draw_mermaid_png()
        
        # Save to file
        with open("agent_graph.png", "wb") as f:
            f.write(image_data)
        print("✅ Graph saved to agent_graph.png")
        
        # If in IPython/Jupyter, display it
        if in_ipython:
            display(Image(image_data))
            print("✅ Graph displayed above!")
        
        # Otherwise, try to open it
        import subprocess
        import platform
        if platform.system() == 'Darwin':  # macOS
            subprocess.run(['open', 'agent_graph.png'])
            print("✅ Opening graph in default image viewer...")
        elif platform.system() == 'Linux':
            subprocess.run(['xdg-open', 'agent_graph.png'])
        elif platform.system() == 'Windows':
            subprocess.run(['start', 'agent_graph.png'], shell=True)
            
    except Exception as e:
        print(f"\n❌ Error generating graph: {e}")
        print("\nThis might be due to the Mermaid service being unavailable.")
        print("The graph structure was saved to agent_graph.mermaid")
        print("You can visualize it at: https://mermaid.live/")


if __name__ == "__main__":
    show_agent_graph()