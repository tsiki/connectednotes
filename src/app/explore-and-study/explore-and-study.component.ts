import {Component, Inject, OnInit} from '@angular/core';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';

@Component({
  selector: 'app-explore-and-study',
  template: `
    <mat-tab-group mat-stretch-tabs>
      <mat-tab label="Flashcards">
        <app-study></app-study>
      </mat-tab>
      <mat-tab label="Graph">
        <app-graph></app-graph>
      </mat-tab>
    </mat-tab-group>
  `,
  styles: [``]
})
export class ExploreAndStudyComponent implements OnInit {

  constructor() {
  }

  ngOnInit(): void {
  }
}
