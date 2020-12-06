import {async, ComponentFixture, TestBed, waitForAsync} from '@angular/core/testing';

import {StudyComponent} from './study.component';


fdescribe('StudyComponent', () => {
  let component: ComponentFixture<StudyComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      declarations: [ StudyComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    component = TestBed.createComponent(StudyComponent);
  });
});
