import {AfterViewInit, Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import {NoteService} from '../note.service';


import * as d3 from 'd3';
import {SimulationNodeDatum} from 'd3-force';
import {NoteAndLinks} from '../types';

@Component({
  selector: 'app-graph',
  template: `<div id="graph" #graph></div>`,
  styles: [`
    #graph {
      height: 50%;
    }
  `]
})
export class GraphComponent implements AfterViewInit {
  @ViewChild('graph') graph: ElementRef;

  constructor(private readonly noteService: NoteService) { }

  ngAfterViewInit() {
    this.displayGraphs(this.noteService.getGraphRepresentation());
  }

  private displayGraphs(notesAndLinks: NoteAndLinks[]) {
    const width = 500;
    const height = 500;

    const nodes = [];
    const links = [];

    const oldestChange = Math.min(...notesAndLinks.map(n => n.lastChanged));
    const newestChange = Math.max(...notesAndLinks.map(n => n.lastChanged));
    const range = newestChange - oldestChange;

    const getGreenToRed = (percent) => {
      return `hsl(${100 * percent + 28}, 100%, 50%)`;
    };

    for (const noteWithLinks of notesAndLinks) {
      const id = noteWithLinks.noteTitle;
      nodes.push({id, relativeFreshness: getGreenToRed((noteWithLinks.lastChanged - oldestChange) / range)});
      for (const destination of noteWithLinks.connectedTo) {
        links.push({source: noteWithLinks.noteTitle, target: destination, value: 1});
      }
    }

    const drag = sim => {

      function dragstarted(d) {
        if (!d3.event.active) {
          sim.alphaTarget(0.3).restart();
        }
        d.fx = d.x;
        d.fy = d.y;
      }

      function dragged(d) {
        d.fx = d3.event.x;
        d.fy = d3.event.y;
      }

      function dragended(d) {
        if (!d3.event.active) {
          sim.alphaTarget(0);
        }
        d.fx = null;
        d.fy = null;
      }

      return d3.drag()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended);
    };


    // Naive attempt at layering the nodes so the texts overlap a bit less
    const fnForceY = (d: SimulationNodeDatum, i: number, data: SimulationNodeDatum[]) => {
      return 0.1 - 0.1 * i / nodes.length;
    };

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => (d as any).id))
      .force('charge', d3.forceManyBody())
      .force('x', d3.forceX().strength(0.01))
      .force('y', d3.forceY().strength(fnForceY));

    const zoom = d3.zoom()
      .filter(() => !d3.event.button)
      .wheelDelta(() => { // TODO: remove this when this has been updated in the d3 library itself
        const event = d3.event;
        return -event.deltaY * (event.deltaMode === 1 ? 0.05 : event.deltaMode ? 1 : 0.002)
          * (event.ctrlKey ? 5 : 1);
      })
      .on('zoom', () => { svg.attr('transform', d3.event.transform); });

    const svg = d3.create('svg')
      .call(zoom)
      .attr('viewBox', [-width / 2, -height / 2, width, height] as any);

    const link = svg.append('g')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke-width', d => Math.sqrt(d.value));

    const node = svg.append('g')
      .attr('stroke', '#000')
      .selectAll('.node')
      .data(nodes)
      .join('g')
      .call(drag(simulation));

    const circle = node.append('circle')
      .style('fill', e => e.relativeFreshness)
      .attr('r', 5)
      .attr('fill', '#999');

    const text = node.append('text')
      .attr('stroke', 'none')
      .style('font-size', '9px')
      .attr('x', 6)
      .attr('y', 3)
      .text((d) => d.id);

    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      circle
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      text.attr('transform', (d, i) => `translate(${d.x},${d.y})`);
    });

    this.graph.nativeElement.appendChild(svg.node());
  }
}
