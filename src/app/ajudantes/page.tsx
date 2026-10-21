'use client';

import { useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { 
  Trash2, 
  Loader2, 
  ShieldCheck, 
  Building,
  Share2,
  User as UserIcon,
  Info
} from 'lucide-react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { updateDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

export default function AjudantesPage() {
  const [helperToDelete, setHelperToDelete] = useState<string | null>(null);
  const { toast } = useToast();
  const firestore = useFirestore();
  const { user } = useUser();

  const myCongQuery = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return query(collection(firestore, 'congregations'), where('authorizedUsers', 'array-contains', user.uid));
  }, [firestore, user?.uid]);

  const { data: myCongs, isLoading: isLoadingMyCong } = useCollection<any>(myCongQuery);
  const myCong = myCongs?.[0];

  const helpers = (myCong?.authorizedUsers || []) as string[];
  const helpersStr = JSON.stringify(helpers);

  const helperProfilesQuery = useMemoFirebase(() => {
    const list = JSON.parse(helpersStr) as string[];
    if (!firestore || list.length === 0) return null;
    return query(collection(firestore, 'users'), where('__name__', 'in', list.slice(0, 30)));
  }, [firestore, helpersStr]);

  const { data: helperProfiles } = useCollection<any>(helperProfilesQuery);

  const isAdmin = myCong?.adminUid === user?.uid;

  const handleShareInvite = () => {
    if (!myCong || !firestore || !isAdmin) return;
    
    const inviteRef = doc(collection(firestore, 'congregations', myCong.id, 'invites'));
    const inviteId = inviteRef.id;
    
    setDocumentNonBlocking(inviteRef, {
      congregationId: myCong.id,
      createdAt: new Date().toISOString()
    });

    const inviteLink = `${window.location.origin}/convite?id=${myCong.id}&token=${inviteId}`;
    const message = `Olá! Convido você para ser um ajudante na gestão da agenda de oradores da congregação *${myCong.name}*.\n\nClique no link abaixo para aceitar o convite:\n${inviteLink}`;
    
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://api.whatsapp.com/send?text=${encodedMessage}`, '_blank');
    
    toast({ title: "Convite Único Gerado!", description: "Link de uso único enviado para o WhatsApp." });
  };

  const removeHelper = (helperUid: string) => {
    if (!firestore || !myCong || !isAdmin) return;
    
    const authorizedUsers = (myCong.authorizedUsers || []) as string[];
    const updatedHelpers = authorizedUsers.filter(id => id !== helperUid);
    
    const docRef = doc(firestore, 'congregations', myCong.id);
    updateDocumentNonBlocking(docRef, { authorizedUsers: updatedHelpers });
    
    toast({ title: "Removido", description: "O acesso do ajudante foi revogado." });
    setHelperToDelete(null);
  };

  const getHelperProfile = (uid: string) => {
    return helperProfiles?.find(p => p.id === uid);
  };

  const getHelperDisplayName = (uid: string) => {
    const profile = getHelperProfile(uid);
    if (profile?.displayName) return profile.displayName;
    if (uid === user?.uid) return user.displayName || user.email;
    return `Usuário (${uid.substring(0, 6)}...)`;
  };

  if (isLoadingMyCong) return <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  if (!myCong) return (
    <div className="p-20 text-center">
      <Building className="mx-auto h-12 w-12 text-muted-foreground" />
      <h2 className="text-xl font-bold mt-4 font-headline">Configuração Necessária</h2>
      <Link href="/setup">
        <Button className="mt-6 bg-accent text-accent-foreground hover:bg-accent/90">Configurar Agora</Button>
      </Link>
    </div>
  );

  return (
    <div className="flex flex-col gap-6 animate-fade-in max-w-4xl mx-auto w-full">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold md:text-2xl font-headline flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-primary" /> Equipe de Ajudantes
          </h1>
          <p className="text-muted-foreground">Usuários autorizados a gerenciar a agenda de {myCong.name}.</p>
        </div>
        {isAdmin && (
          <Button onClick={handleShareInvite} className="gap-2 bg-green-600 hover:bg-green-700 text-white border-none shadow-md h-12 px-6">
            <Share2 className="h-5 w-5" /> Gerar Link de Convite
          </Button>
        )}
      </div>

      {!isAdmin && (
        <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg text-blue-800 text-sm flex gap-3 items-center">
          <Info className="h-5 w-5 shrink-0" />
          <p>Você é um ajudante nesta congregação. Somente o administrador principal pode convidar ou remover membros.</p>
        </div>
      )}

      <div className="space-y-4">
        <h2 className="text-lg font-bold font-headline px-1">Membros Atuais</h2>
        <div className="grid grid-cols-1 gap-3">
          {helpers.map(helperUid => {
            const profile = getHelperProfile(helperUid);
            const isSelf = helperUid === user?.uid;
            const isOwner = helperUid === myCong.adminUid;

            return (
              <Card key={helperUid} className="border-none shadow-sm flex items-center justify-between p-4 group">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 border border-primary/10">
                    <AvatarImage src={profile?.photoURL || ''} alt={getHelperDisplayName(helperUid)} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getHelperDisplayName(helperUid).slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col">
                    <span className="font-bold text-sm">
                      {getHelperDisplayName(helperUid)}
                      {isSelf && <span className="ml-2 text-[10px] text-muted-foreground">(Você)</span>}
                    </span>
                    {isOwner && (
                      <Badge variant="outline" className="w-fit text-[10px] py-0 h-4 border-primary text-primary mt-1">Administrador</Badge>
                    )}
                  </div>
                </div>
                {isAdmin && !isOwner && !isSelf && (
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-destructive"
                    onClick={() => setHelperToDelete(helperUid)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </Card>
            );
          })}
          {helpers.length === 0 && (
            <div className="py-10 text-center border-2 border-dashed rounded-lg bg-muted/5">
              <p className="text-sm text-muted-foreground">Nenhum ajudante cadastrado ainda.</p>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!helperToDelete} onOpenChange={(o) => !o && setHelperToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revogar Acesso?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="text-sm text-muted-foreground">
                Tem certeza que deseja remover este ajudante? Ele não terá mais acesso aos dados desta congregação.
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => helperToDelete && removeHelper(helperToDelete)} 
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Remover Acesso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
