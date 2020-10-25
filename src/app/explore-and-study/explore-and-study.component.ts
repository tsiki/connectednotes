import {Component, Inject, OnInit} from '@angular/core';
import {SubviewManagerService} from '../subview-manager.service';

@Component({
  selector: 'app-explore-and-study',
  template: `
    <div id="wrapper">
      <mat-tab-group mat-stretch-tabs>
        <mat-tab label="Flashcards">
          <app-study></app-study>
        </mat-tab>
        <mat-tab label="Graph">
          <app-graph></app-graph>
        </mat-tab>
      </mat-tab-group>
      <button id="close-button" mat-button (click)="closeView()" matTooltip="close view">
        <mat-icon>close</mat-icon>
      </button>
    </div>
  `,
  styles: [`
      #wrapper {
        position: relative;
      }

      #close-button {
        position: absolute;
        right: 0;
        top: 0;
        z-index: 10;
        height: 50px;
      }
  `]
})
export class ExploreAndStudyComponent implements OnInit {

  constructor(private readonly subviewManager: SubviewManagerService) {
  }

  ngOnInit(): void {
  }

  async closeView() {
    // this.subviewManager.closeExploreAndStudy();
  }
}
