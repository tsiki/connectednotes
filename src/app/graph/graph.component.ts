import {AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild, ViewEncapsulation} from '@angular/core';
import {StorageService} from '../storage.service';
import * as d3 from 'd3';
import {SimulationNodeDatum} from 'd3-force';
import {NoteAndLinks} from '../types';
import {SubviewManagerService} from '../subview-manager.service';




// Cytoscape imports
// ------------------

// Core library
import cytoscape, {ElementsDefinition, LayoutOptions} from 'cytoscape';
// Import graph layouts which are going to be used with core library
import fcose from 'cytoscape-fcose';
cytoscape.use(fcose);

// d3-force layout
// import d3force from 'cytoscape-d3-force';
// cytoscape.use( d3force );

// popper extension for showing details on pop-ups
import {debounceTime, takeUntil} from 'rxjs/operators';
import {SettingsService} from '../settings.service';
import {combineLatest, ReplaySubject} from 'rxjs';

@Component({
  selector: 'app-graph',
  template: `
    <div id="top-bar">
      <span><!-- this element is for centering the dropdown --></span>
      <button mat-button (click)="closeView()" matTooltip="close view">
        <mat-icon>close</mat-icon>
      </button>
    </div>
    <div id="graph" #graph></div>
<!--    Graph view coming by the end of January-->
  `,
  encapsulation: ViewEncapsulation.None,
  styles: [`
    #graph {
      height: 50%;
    }

    #top-bar {
      display: flex;
      justify-content: space-between;
      height: var(--top-bar-height);
      background: var(--secondary-background-color);
      border-bottom: 1px solid var(--gutter-color);
    }

    #graph {
      height: 100%;
    }
    /* Theme styles */
    .graph {
      background: var(--primary-background-color);
    }
  `],
})
export class GraphComponent implements OnDestroy {
  @ViewChild('graph') graph: ElementRef;

  private cy: cytoscape.Core;
  private destroyed = new ReplaySubject<any>(1);

  constructor(private readonly storage: StorageService,
              private readonly settings: SettingsService,
              private readonly subviewManager: SubviewManagerService) {
    combineLatest([this.storage.notes, this.settings.themeSetting])
        .pipe(takeUntil(this.destroyed))
        .pipe(debounceTime(500))
        .subscribe(unused => {
          this.displayCytograph(this.storage.getGraphRepresentation());
          this.updateCytographStyles();
        });
  }

  ngOnDestroy() {
    this.destroyed.next(undefined);
  }

  closeView() {
    this.subviewManager.closeView('graph');
  }


  /**
   * Generate nodes and edges data for the graph.
   * For use in cytoscape graph
   *
   * @private
   * @param {NoteAndLinks[]} notesAndLinks
   * @returns {Object}
   * {
   *  nodes: [{
   *    data: { id: 'a' }
   *  }, ...],
   *  egdes: [{
   *    data: { id: 'ab', source: 'a', target: 'b' }
   *  }, ...]
   * }
   *
   * A node currently supports following "data" properties:
   * 1. id - a unique string id of the node
   * 2. connectedTo - an array of node ids to which this node is directly connected
   * 3. label - a string label of the node
   * 4. fill - color that would fill the node
   * 5. stroke - color of the border of the node. Defaults to fill
   * 6. size - the diameter of the node
   *
   * @memberof GraphComponent
   */
  private createGraphData(notesAndLinks: NoteAndLinks[]): ElementsDefinition {
    const nodes = [];
    const edges = [];

    const oldestChange = Math.min(...notesAndLinks.map(n => n.lastChanged));
    const newestChange = Math.max(...notesAndLinks.map(n => n.lastChanged));
    const range = newestChange - oldestChange;

    const getGreenToRed = (percent) => {
      return `hsl(${100 * percent + 28}, 100%, 50%)`;
    };

    const sNodeClass = 'node';
    const sEdgeClass = 'edge';

    for (const noteWithLinks of notesAndLinks) {

      /**
       * A node currently supports following properties:
       * 1. id - a unique string id of the node
       * 2. connectedTo - an array of node ids to which this node is directly connected
       * 3. label - a string label of the node
       * 4. fill - color that would fill the node
       * 5. stroke - color of the border of the node. Defaults to fill
       * 6. size - the diameter of the node
       */

      const id = noteWithLinks.noteTitle;

      nodes.push({
        classes: [sNodeClass],
        data: {
          id,
          label: id,
          connectedTo: noteWithLinks.connectedTo || [],
          fill: getGreenToRed((noteWithLinks.lastChanged - oldestChange) / range),
          stroke: '#444',
          size: 10,  // diameter
        }
      });

      for (const destination of noteWithLinks.connectedTo) {
        edges.push({
          classes: [sEdgeClass],
          data: {
            source: id,
            target: destination,
            weight: Math.random(),
            color: '#eee',
          }
        });
      }
    }
    return { nodes, edges };
  }

  private updateCytographStyles() {
    const primaryTextColor = getComputedStyle(document.body).getPropertyValue('--primary-text-color');
    // Selector function appears to be mistyped as string
    (this.cy.style().selector as any)('node')
        .style(
            {
              'color': primaryTextColor
            }).update();
    (this.cy.style().selector as any)('edge')
        .style(
            {
              'line-color': primaryTextColor,
              'mid-target-arrow-color': primaryTextColor,
            }).update();

    const hlEdgeColor =
        getComputedStyle(document.body).getPropertyValue('--graph-highlighted-edge-color');
    (this.cy.style().selector as any)('edge.highlighted')
        .style(
            {
              'line-color': hlEdgeColor,
              'mid-target-arrow-color': hlEdgeColor,
            }).update();
    const hlNodeColor =
        getComputedStyle(document.body).getPropertyValue('--graph-highlighted-node-color');
    (this.cy.style().selector as any)('node.highlighted')
        .style(
            {
              'background-color': hlNodeColor,
              'border-color': hlNodeColor,
              'border-width': 1,
            }).update();
  }


  private displayCytograph(notesAndLinks: NoteAndLinks[]) {

    const elGraph = this.graph.nativeElement;
    const data = this.createGraphData(notesAndLinks);

    // settings for a directed graph
    const isDirectedGraph = false;

    // apply theme class to the graph element
    elGraph.classList.add('graph');

    // Edge styles
    // docs: https://js.cytoscape.org/#style/edge-line
    const oGraphEdgeStyles = isDirectedGraph ? {
      'mid-target-arrow-color': 'data(color)',
      'mid-target-arrow-shape': 'triangle',
      'mid-target-arrow-fill': 'fill',
      'arrow-scale': 'mapData(weight, 0, 1, 0.35, 0.75)'
    } : {};

    this.cy = cytoscape({
      container: elGraph,

      boxSelectionEnabled: false,
      autounselectify: true,

      layout: {

        // foces API docs: https://github.com/iVis-at-Bilkent/cytoscape.js-fcose#api
        name: 'fcose',

        // 'draft', 'default' or 'proof'
        // - "draft" only applies spectral layout
        // - "default" improves the quality with incremental layout (fast cooling rate)
        // - "proof" improves the quality with incremental layout (slow cooling rate)
        quality: 'proof',
        // Use random node positions at beginning of layout
        // if this is set to false, then quality option must be "proof"
        randomize: false,
        // Whether or not to animate the layout
        animate: false,
        // Duration of animation in ms, if enabled
        animationDuration: 5000,
        // Easing of animation, if enabled
        animationEasing: 'ease-out',
        // Fit the viewport to the repositioned nodes
        fit: true,
        // Padding around layout
        padding: 30,
        // Whether to include labels in node dimensions. Valid in "proof" quality
        nodeDimensionsIncludeLabels: true,
        // Whether or not simple nodes (non-compound nodes) are of uniform dimensions
        uniformNodeDimensions: false,
        // Whether to pack disconnected components - valid only if randomize: true
        packComponents: false,

        /* spectral layout options */

        // False for random, true for greedy sampling
        samplingType: true,
        // Sample size to construct distance matrix
        sampleSize: 25,
        // Separation amount between nodes
        nodeSeparation: 75,
        // Power iteration tolerance
        piTol: 0.0000001,

        /* incremental layout options */

        // Node repulsion (non overlapping) multiplier
        // smaller value will create dense layout
        nodeRepulsion: 5500,
        // Ideal edge (non nested) length
        idealEdgeLength: 40,
        // Divisor to compute edge forces
        edgeElasticity: 1,
        // Nesting factor (multiplier) to compute ideal edge length for nested edges
        nestingFactor: 0.1,
        // Maximum number of iterations to perform
        numIter: 2500,
        // For enabling tiling i.e. whether to put non-connected nodes together
        tile: false,
        // Represents the amount of the vertical space to put between the zero degree
        // members during the tiling operation(can also be a function)
        tilingPaddingVertical: 10,
        // Represents the amount of the horizontal space to put between the zero degree
        // members during the tiling operation(can also be a function)
        tilingPaddingHorizontal: 10,
        // Gravity force (constant)
        gravity: 0.5,
        // Gravity range (constant) for compounds
        gravityRangeCompound: 1.5,
        // Gravity force (constant) for compounds
        gravityCompound: 1.0,
        // Gravity range (constant)
        gravityRange: 3.8,
        // Initial cooling factor for incremental layout
        initialEnergyOnIncremental: 0.3,

        /* layout event callbacks */
        ready: () => { }, // on layoutready
        stop: () => {
          // can be used to hide a loading indicator
        } // on layoutstop

        // ------------------

        // D3 force settings:
        // ------------------
        // name: 'd3-force',
        // animate: true,
        // fixedAfterDragging: false,
        // linkId: function id(d) {
        //   return d.id;
        // },
        // linkDistance: 80,
        // manyBodyStrength: -300,
        // ready: function(){},
        // stop: function(){},
        // tick: function(progress) {
        //   console.log('progress - ', progress);
        // },
        // randomize: false,
        // infinite: false
      } as LayoutOptions,

      // Using Plain JSON format for graph styling
      // docs: https://js.cytoscape.org/#style/format

      // All size specific numeric units are by default
      // assumed to be in pixels. For e.g. 'border-width': 2
      // implies the border width of a node to be 2px.
      // docs: https://js.cytoscape.org/#style/property-types

      // Data mapping:
      // docs: https://js.cytoscape.org/#style/mappers
      // Properties can be derived from the data.
      // For e.g. node's background color, border, size and label
      // are being derived from the data using notation data(<property-key-name>)

      style: [
        {
          // Style properties that affect the UI global to the graph
          // docs: https://js.cytoscape.org/#style/core
          selector: 'core',
          style: {

          }
        },
        {
          selector: 'node',
          style: {
            'background-color': 'data(fill)',
            'border-color': 'data(stroke)',
            'border-width': 0.5,
            'width': 'data(size)',
            'height': 'data(size)',

            // node's text related properties
            // docs: https://js.cytoscape.org/#style/labels
            // demo: https://js.cytoscape.org/demos/labels/

            'label': 'data(label)',
            'min-zoomed-font-size': 12,
            // label alignment
            'text-valign': 'bottom',
            'text-halign': 'center',
            // label's vertical margin
            'text-margin-y': 2.5,
            // To reduce text in the overall visualisation, we can use 'ellipsis' to restrict the text label
            // to max width represented by 'text-max-width'. The full text and other details
            // can be shown in the Pop-up of the node details.
            'text-wrap': 'wrap',  // none, ellipsis, wrap
            // In 'wrap' mode, manual wraps i.e. \n (new line) in the label will automatically result in wrapping.
            // Auto wrapping can also be enforced by providing text-max-width.
            'text-max-width': '50px',
            'font-size': 6,
            // 'line-height': '1.1',
            'z-index': 1,
          }
        },
        {
          // docs: https://js.cytoscape.org/#style/edge-line
          // docs: https://js.cytoscape.org/#style/edge-endpoints
          selector: 'edge',
          style: Object.assign({
            'width': 'mapData(weight, 0, 1, 0.25, 0.8)',
            'opacity': 1,
            'curve-style': 'straight',
            'line-color': 'data(color)',
            'source-endpoint': 'outside-to-line',
            'target-endpoint': 'outside-to-line',
            'source-distance-from-node': 2,
            'target-distance-from-node': 2
          }, oGraphEdgeStyles)
        },
      ],

      elements: data
    });

    /**
     * Event Bindings
     */

    const toggleNodeHighlight = (sourceNode, source) => {
      sourceNode
          .closedNeighborhood()
          .toggleClass('highlighted');
    };

    // Remove any node/edge highlighting from the graph
    const clearHighlighting = () => {
      const sClass = 'highlighted';
      this.cy.$(`.${sClass}`).toggleClass(sClass, false)
          .forEach((node: any, i) => {
            // removing any tooltips here
          });
    };

    // 1. When tapped on the background, remove all highlighting
    this.cy.on('tap', (event) => {
      const evt = event.target;
      if (evt === this.cy) {
        clearHighlighting();
      }
    });

    // 2. Neighborhood highlighting
    // docs: https://js.cytoscape.org/#collection/traversing
    // docs: https://js.cytoscape.org/#collection/style
    // On mouseout from the nodes, disable the highlighting on the neighbour elements
    this.cy.on('mouseout', 'node', (event) => {
      const sourceNode = event.target;
      toggleNodeHighlight(sourceNode, 'mouseout');
    });

    // On mouseover on the nodes, enable the highlighting on its immediate neighbour elements
    this.cy.on('mouseover', 'node', (event) => {
      const sourceNode = event.target;
      toggleNodeHighlight(sourceNode, 'mouseover');
    });
    // For touch devices
    this.cy.on('tap', 'node', (event) => {
      const sourceNode = event.target;
      toggleNodeHighlight(sourceNode, 'tap');
    });

    // The callback run as soon as the graph is ready.
    this.cy.ready(() => {

    });
  }
}
