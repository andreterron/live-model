import { useLiveState, useModel, type LiveModelType } from 'live-model';
import { BooleanControl } from './controls';
import { CardRow } from '../card-row';
import { Card } from '../ui/card';
import { ArrowUpDownIcon, ChevronsUpDownIcon, TrashIcon } from 'lucide-react';
import { useCallback } from 'react';
import { Button } from '../ui/button';

interface Task extends LiveModelType {
  id: string;
  title: string;
  checked: boolean;
}

export function CollectionsSample() {
  const { create, deleteById, items, updateById } =
    useModel<Task>('04-collections');

  const createTask = useCallback(() => {
    create({
      checked: false,
      title: randomTaskTitle(),
    });
  }, [create]);

  return (
    <div className="flex flex-col gap-3">
      <Card className="max-w-md divide-y overflow-hidden">
        {items.map((item) => (
          <CardRow
            key={item.id}
            label={item.title}
            buttons={
              <Button
                variant="ghost"
                size="icon"
                onClick={() => deleteById(item.id)}
              >
                <TrashIcon />
              </Button>
            }
            className="grow shrink"
          >
            <BooleanControl
              value={item.checked}
              onChange={(v) => updateById(item.id, { ...item, checked: v })}
            />
          </CardRow>
        ))}
        <Button
          variant="ghost"
          className="rounded-none w-full justify-start"
          onClick={() => createTask()}
        >
          Create
        </Button>
      </Card>
    </div>
  );
}

function randomTaskTitle() {
  return sampleTaskTitles[Math.floor(Math.random() * sampleTaskTitles.length)];
}

const sampleTaskTitles = [
  'Buy milk',
  'Walk the dog',
  'Do laundry',
  'Clean the kitchen',
  'Mow the lawn',
  'Pay bills',
  'Buy groceries',
  'Take out the trash',
  'Vacuum the living room',
  'Dust the furniture',
  'Wash the dishes',
  'Iron clothes',
  'Clean the bathroom',
  'Organize the closet',
  'Do the dishes',
  'Sweep the floor',
  'Clean the windows',
  'Rake the leaves',
  'Shovel snow',
  'Water plants',
];
