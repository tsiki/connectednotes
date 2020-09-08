import {Directive, Input} from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroupDirective,
  NG_VALIDATORS,
  NgForm,
  Validator,
} from '@angular/forms';
import {NoteService} from './note.service';
import {ErrorStateMatcher} from '@angular/material/core';

/** Error when invalid control is dirty. */
export class ValidateImmediatelyMatcher implements ErrorStateMatcher {
  isErrorState(control: FormControl | null, form: FormGroupDirective | NgForm | null): boolean {
    return control && control.invalid && control.value;
  }
}

@Directive({
  selector: '[appAlreadyExistingNote]',
  providers: [{provide: NG_VALIDATORS, useExisting: AlreadyExistingNoteDirective, multi: true}]
})
export class AlreadyExistingNoteDirective implements Validator {
  @Input() alreadyExistingTitle;

  constructor(private noteService: NoteService) {}

  validate(control: AbstractControl): {[key: string]: any} | null {
    const noteExists = control.value ? !!this.noteService.getNoteForTitleCaseInsensitive(control.value) : false;
    return noteExists && control.value !== this.alreadyExistingTitle
        ? {forbiddenName: {value: control.value}}
        : null;
  }
}
