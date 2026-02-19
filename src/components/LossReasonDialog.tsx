import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useState } from 'react';

const MOTIVOS_PERDA = [
  'No-Show',
  'Lead não qualificado',
  'Achou caro',
  'Perdeu pro Concorrente',
  'Sumiu na negociação',
];

interface LossReasonDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (motivo: string) => void;
}

export default function LossReasonDialog({ open, onOpenChange, onConfirm }: LossReasonDialogProps) {
  const [motivo, setMotivo] = useState('');

  const handleConfirm = () => {
    if (motivo) {
      onConfirm(motivo);
      setMotivo('');
    }
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) setMotivo('');
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Motivo da Perda</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <Select value={motivo} onValueChange={setMotivo}>
            <SelectTrigger className="w-full bg-card border-border">
              <SelectValue placeholder="Selecione o motivo..." />
            </SelectTrigger>
            <SelectContent className="bg-popover border-border z-50">
              {MOTIVOS_PERDA.map(m => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!motivo}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
