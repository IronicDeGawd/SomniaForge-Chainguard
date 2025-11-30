import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Plus, AlertCircle } from 'lucide-react';
import { ParsedContract } from '@/utils/contractParser';

interface BulkAddModalProps {
    isOpen: boolean;
    onClose: () => void;
    contracts: ParsedContract[];
    onConfirm: (contracts: ParsedContract[]) => void;
}

export function BulkAddModal({ isOpen, onClose, contracts: initialContracts, onConfirm }: BulkAddModalProps) {
    const [contracts, setContracts] = useState<ParsedContract[]>(initialContracts);

    // Sync state with props when modal opens or contracts change
    useEffect(() => {
        if (isOpen) {
            setContracts(initialContracts);
        }
    }, [isOpen, initialContracts]);

    const handleRemove = (index: number) => {
        const newContracts = [...contracts];
        newContracts.splice(index, 1);
        setContracts(newContracts);
    };

    const handleUpdate = (index: number, field: keyof ParsedContract, value: string) => {
        const newContracts = [...contracts];
        newContracts[index] = { ...newContracts[index], [field]: value };
        setContracts(newContracts);
    };

    const handleConfirm = () => {
        onConfirm(contracts);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Bulk Add Contracts</DialogTitle>
                    <DialogDescription>
                        Review the contracts detected from your clipboard. You can edit names or remove entries before adding.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4">
                    <ScrollArea className="h-[300px] pr-4">
                        <div className="space-y-4">
                            {contracts.map((contract, index) => (
                                <div key={index} className="flex items-start gap-3 p-3 border rounded-lg bg-muted/30">
                                    <div className="grid grid-cols-2 gap-3 flex-1">
                                        <div className="space-y-1">
                                            <Label htmlFor={`name-${index}`} className="text-xs">Name</Label>
                                            <Input
                                                id={`name-${index}`}
                                                value={contract.name}
                                                onChange={(e) => handleUpdate(index, 'name', e.target.value)}
                                                className="h-8 text-sm"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label htmlFor={`address-${index}`} className="text-xs">Address</Label>
                                            <Input
                                                id={`address-${index}`}
                                                value={contract.address}
                                                onChange={(e) => handleUpdate(index, 'address', e.target.value)}
                                                className="h-8 text-sm font-mono"
                                            />
                                        </div>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="mt-6 h-8 w-8 text-muted-foreground hover:text-destructive"
                                        onClick={() => handleRemove(index)}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))}

                            {contracts.length === 0 && (
                                <div className="flex flex-col items-center justify-center h-40 text-muted-foreground border-2 border-dashed rounded-lg">
                                    <AlertCircle className="w-8 h-8 mb-2 opacity-20" />
                                    <p>No contracts to add</p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleConfirm} disabled={contracts.length === 0}>
                        Add {contracts.length} Contracts
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
