import {Component, ElementRef, Inject, ViewChild} from '@angular/core';
import {COMMA, ENTER, SPACE} from '@angular/cdk/keycodes';
import {MatAutocomplete, MatAutocompleteSelectedEvent} from '@angular/material/autocomplete';
import {FormControl} from '@angular/forms';
import {Observable} from 'rxjs';
import {map} from 'rxjs/operators';
import {NoteService} from '../note.service';
import {MatChipInputEvent} from '@angular/material/chips';
import {MAT_DIALOG_DATA, MatDialogRef} from '@angular/material/dialog';
import {AUTOMATICALLY_GENERATED_TAG_NAMES, ROOT_TAG_NAME} from '../constants';
import {MatSnackBar} from '@angular/material/snack-bar';

@Component({
  selector: 'app-edit-tag-parents-dialog',
  template: `
    <h1>Parent tags for {{tag}}</h1>
    <mat-form-field class="chip-list">
      <mat-label>Parent tags</mat-label>
      <mat-chip-list #chipList aria-label="Parent tag selection">
        <mat-chip
            [selectable]="false"
            *ngFor="let tag of parentTags"
            (removed)="removeParentTag(tag)">
          {{tag}}
          <mat-icon matChipRemove>cancel</mat-icon>
        </mat-chip>
        <input
            placeholder="New parent tag..."
            #parentTagInput
            [formControl]="parentTagCtrl"
            [matAutocomplete]="auto"
            [matChipInputFor]="chipList"
            [matChipInputSeparatorKeyCodes]="separatorKeysCodes"
            (matChipInputTokenEnd)="add($event)">
      </mat-chip-list>
      <mat-autocomplete #auto="matAutocomplete" (optionSelected)="selected($event)">
        <mat-option *ngFor="let tag of filteredParentTags | async" [value]="tag">
          {{tag}}
        </mat-option>
      </mat-autocomplete>
    </mat-form-field>
    <div>
      <button mat-button (click)="saveAndClose()">save</button>
      <button mat-button (click)="dialogRef.close()">cancel</button>
    </div>
  `,
  styles: [`
    .chip-list {
      min-width: 500px;
    }
  `]
})
export class EditTagParentsDialogComponent {
  @ViewChild('auto') matAutocomplete: MatAutocomplete;
  @ViewChild('parentTagInput') parentTagInput: ElementRef<HTMLInputElement>;

  tag: string;
  allTags: string[] = [];
  parentTags: string[] = [];
  parentTagCtrl = new FormControl();
  separatorKeysCodes: number[] = [ENTER, COMMA, SPACE];
  filteredParentTags: Observable<string[]>;

  private originalParentTags: string[] = [];

  constructor(
      public dialogRef: MatDialogRef<EditTagParentsDialogComponent>,
      @Inject(MAT_DIALOG_DATA) public data: any,
      private readonly noteService: NoteService,
      private snackBar: MatSnackBar) {
    this.tag = data.tag;
    this.noteService.tagGroups.subscribe(
        tgs => {
          const selectableParentTags = tgs.map(tg => tg.tag)
              .filter(tag => !AUTOMATICALLY_GENERATED_TAG_NAMES.includes(tag));
          selectableParentTags.push(ROOT_TAG_NAME);
          this.allTags = selectableParentTags;
        });
    this.noteService.nestedTagGroups.subscribe(ntgs => {
      for (const [parentTag, childTags] of Object.entries(ntgs)) {
        if (childTags.includes(this.tag)) {
          this.parentTags.push(parentTag);
        }
        this.originalParentTags = this.parentTags.slice();
        if (this.parentTags.length === 0) {
          this.parentTags.push(ROOT_TAG_NAME);
        }
      }
    });
    this.filteredParentTags = this.parentTagCtrl.valueChanges.pipe(
        map((tag: string | null) => tag ? this._filter(tag) : this.allTags.slice()));
  }

  add(event: MatChipInputEvent): void {
    const input = event.input;
    const value = event.value;

    if ((value || '').trim()) {
      this.parentTags.push(value.trim());
    }

    // Reset the input value
    if (input) {
      input.value = '';
    }

    this.parentTagCtrl.setValue(null);
  }

  selected(event: MatAutocompleteSelectedEvent): void {
    this.parentTags.push(event.option.viewValue);
    this.parentTagInput.nativeElement.value = '';
    this.parentTagCtrl.setValue(null);
  }

  removeParentTag(tag: string) {
    const index = this.parentTags.indexOf(tag);
    if (index >= 0) {
      this.parentTags.splice(index, 1);
    }
    this.snackBar.open(
        `If no tags are specified, the tag will appear at the root level.`,
        null,
        {duration: 5000});
  }

  saveAndClose() {
    this.noteService.updateParentTags(this.tag, this.parentTags);
    this.dialogRef.close();
  }

  private _filter(value: string): string[] {
    const filterValue = value.toLowerCase();
    return this.allTags.filter(tag => tag.toLowerCase().indexOf(filterValue) === 0);
  }
}
