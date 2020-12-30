import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TagGroupComponent } from './tag-group.component';

describe('TagGroupComponent', () => {
  let component: TagGroupComponent;
  let fixture: ComponentFixture<TagGroupComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ TagGroupComponent ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(TagGroupComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

});
