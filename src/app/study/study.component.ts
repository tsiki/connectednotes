import {Component, OnDestroy, OnInit} from '@angular/core';
import {NoteService} from '../note.service';
import {Flashcard} from '../types';
import {Subscription} from 'rxjs';
import {SettingsService} from '../settings.service';
import {FlashcardService} from '../flashcard.service';
import {SubviewManagerService} from '../subview-manager.service';

@Component({
  selector: 'app-study',
  template: `
    <div id="top-bar">
      <span><!-- this element is for centering the dropdown --></span>
      <mat-form-field id="queue-dropdown" appearance="fill">
        <mat-label>Flashcard queue</mat-label>
        <mat-select [(value)]="selectedQueue" (selectionChange)="queueChanged()">
          <span class="queue-option-container" *ngFor="let queue of fcQueues">
            <mat-option [value]="queue[0]">
              <span class="queue-info-container">
                <span class="queue-name">{{queue[0]}}</span>
              </span>
            </mat-option>
            <span class="due-count">{{dueFcQueues.get(queue[0])?.length || 0}}/{{queue[1]?.length || 0}} due</span>
          </span>
        </mat-select>
      </mat-form-field>

      <button mat-button (click)="closeView()" matTooltip="close note">
        <mat-icon>close</mat-icon>
      </button>
    </div>
    <div id="fc-container">
      <div *ngIf="allFcs.length === 0">You haven't created any flashcards.</div>
      <div *ngIf="allFcs.length > 0 && dueFcsQueue.length === 0">
        All done!
      </div>
      <div id="due-fcs-container" class="raisedbox" *ngIf="dueFcsQueue.length > 0">
        <div class="fc-side">{{displayedFc.side1}}</div>
        <button mat-button *ngIf="!revealed" (click)="reveal()">show answer</button>
        <ng-container *ngIf="revealed">
          <div id="rating-container">
            <button mat-button (click)="submitRating(3, displayedFc)">Easy</button>
            <button mat-button (click)="submitRating(2, displayedFc)">Moderate</button>
            <button mat-button (click)="submitRating(1, displayedFc)">Hard</button>
            <button mat-button (click)="submitRating(0, displayedFc)">No idea</button>
          </div>
          <div class="fc-side">{{displayedFc.side2}}</div>
        </ng-container>
      </div>
    </div>
  `,
  styles: [`
    :host {
      background: var(--primary-background-color);
      display: flex;
      flex-direction: column;
      justify-content: space-around;
    }

    .queue-option-container {
      align-items: center;
      display: flex;
      position: relative;
    }

    .queue-option-container mat-option {
      display: inline-block;
      flex-grow: 1;
    }

    #top-bar {
      display: flex;
      justify-content: space-between;
      height: var(--top-bar-height);
      background: var(--secondary-background-color);
      border-bottom: 1px solid var(--gutter-color);
    }

    #due-fcs-container {
      border-radius: 6px;
      box-shadow: 0 0 10px #bdbdbd;
      display: flex;
      flex-direction: column;
      margin: 20px;
      max-width: 350px;
      /*min-height: 500px;*/
      padding: 10px;
    }

    #queue-dropdown {
      margin-left: 60px;
      width: 350px;
    }

    #rating-container {
      display: flex;
      justify-content: space-between;
    }

    #rating-container > button {
      flex-grow: 1;
    }

    #fc-container {
      display: flex;
      justify-content: space-around;
    }

    .due-count {
      color: var(--low-contrast-text-color);
      position: absolute;
      right: 5px;
    }

    .queue-info-container {
      display: flex;
      justify-content: space-between;
    }

  `]
})
export class StudyComponent implements OnInit, OnDestroy {

  private static dueFcQueueName = 'due flashcards';
  private static allFcQueueName = 'all flashcards';
  displayedFc?: Flashcard;
  revealed: boolean;
  allFcs: Flashcard[] = [];
  dueFcsQueue: Flashcard[] = [];
  fcQueues: [string, Flashcard[]][];
  dueFcQueues: Map<string, Flashcard[]>;
  numDueFcs: Map<string, number>;
  selectedQueue = StudyComponent.dueFcQueueName;

  private sub: Subscription;

  constructor(
      private readonly noteService: NoteService,
      private readonly flashcardService: FlashcardService,
      private readonly settings: SettingsService,
      private readonly subviewManager: SubviewManagerService) {
    this.sub = this.flashcardService.flashcards.subscribe(fcs => {
      if (!fcs) {
        return;
      }
      this.calculateQueues(fcs);
      this.allFcs = fcs;
      this.dueFcsQueue = this.flashcardService.getDueFlashcards();
      // Present first note automatically
      this.setNextFlashcard();
    });
  }

  queueChanged() {
    this.dueFcsQueue = this.dueFcQueues.get(this.selectedQueue);
  }

  ngOnInit(): void {
  }

  ngOnDestroy(): void {
    this.sub.unsubscribe();
  }

  reveal() {
    this.revealed = true;
  }

  setNextFlashcard() {
    this.dueFcsQueue = this.dueFcQueues.get(this.selectedQueue);
    this.displayedFc = this.dueFcsQueue[0];
  }

  submitRating(rating: number, fc: Flashcard) {
    this.flashcardService.submitFlashcardRating(rating, fc);
    this.dueFcsQueue = this.dueFcsQueue.slice(1);
    if (this.dueFcsQueue.length > 0) {
      this.displayedFc = this.dueFcsQueue[0];
    }
  }

  closeView() {
    this.subviewManager.closeView('flashcard');
  }

  private calculateQueues(fcs: Flashcard[]) {
    const queueToFcs = new Map<string, Flashcard[]>();
    const queueToDueFcs = new Map<string, Flashcard[]>();
    const dueFcs: Flashcard[] = [];
    const allFcs: Flashcard[] = [];
    for (const fc of fcs) {
      for (const tag of fc.tags) {
        if (!queueToFcs.has(tag)) {
          queueToFcs.set(tag, []);
        }
        queueToFcs.get(tag).push(fc);
        allFcs.push(fc);
        if (this.flashcardService.isDue(fc)) {
          if (!queueToDueFcs.has(tag)) {
            queueToDueFcs.set(tag, []);
          }
          queueToDueFcs.get(tag).push(fc);
          dueFcs.push(fc);
        }
      }
    }
    this.fcQueues = [
      [StudyComponent.dueFcQueueName, dueFcs],
      [StudyComponent.allFcQueueName, allFcs],
      ...queueToFcs.entries(),
    ];
    queueToDueFcs.set(StudyComponent.dueFcQueueName, dueFcs);
    queueToDueFcs.set(StudyComponent.allFcQueueName, allFcs);
    this.dueFcQueues = queueToDueFcs;
  }
}
