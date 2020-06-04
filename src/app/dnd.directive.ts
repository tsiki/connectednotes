import {Directive, EventEmitter, HostListener, Output} from '@angular/core';
import {AngularFireStorage} from '@angular/fire/storage';
import {NoteService} from './note.service';
import {DragAndDropImage} from './types';

@Directive({
  selector: '[appDnd]'
})
export class DndDirective {
  @Output() imageDropped = new EventEmitter<DragAndDropImage>();

  constructor(private readonly noteService: NoteService) { }

  @HostListener('drop', ['$event'])
  async evtDrop(e) {
    e.stopPropagation(); // For some reason this handler is called twice without this, no clue why
    const files = e.dataTransfer.files;
    if (files.length !== 1) {
      throw new Error(`Was expecting 1 file. Got ${files.length}.`);
    }
    const file = files[0];
    const name = file.name;
    // TODO: make sure the image name is unique, otherwise it'll just be overwritten
    const url = await this.noteService.saveImage(file, file.type, file.name);
    this.imageDropped.emit({name, url});
  }
}
