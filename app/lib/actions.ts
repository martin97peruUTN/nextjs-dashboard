'use server';

/**
 * By adding the 'use server', you mark all the exported functions within the file as server functions. 
 * These server functions can then be imported into Client and Server components, 
 * making them extremely versatile.
 * You can also write Server Actions directly inside Server Components by adding "use server" 
 * inside the action. But for this course, we'll keep them all organized in a separate file. 
 * */

//!Even if my form is client-side ('use client') this method will execute on the server

import { sql } from '@vercel/postgres';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod'; //TypeScript-first schema validation with static type inference

const FormSchema = z.object({
    id: z.string(),
    customerId: z.string(),
    amount: z.coerce.number(),
    status: z.enum(['pending', 'paid']),
    date: z.string(),
});

const CreateInvoice = FormSchema.omit({ id: true, date: true });

export async function createInvoice(formData: FormData) {
    console.log("I'm in the server!")

    // const rawFormData = {
    //     customerId: formData.get('customerId'), //the id of the fields
    //     amount: formData.get('amount'),
    //     status: formData.get('status'),
    // };
    // Test it out:
    // console.log(rawFormData);
    const { customerId, amount, status } = CreateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });
    const amountInCents = amount * 100;
    const date = new Date().toISOString().split('T')[0];

    await sql`
        INSERT INTO invoices (customer_id, amount, status, date)
        VALUES (${customerId}, ${amountInCents}, ${status}, ${date})
    `;

    //Once the database has been updated, the /dashboard/invoices path will be revalidated, 
    //and fresh data will be fetched from the server.
    revalidatePath('/dashboard/invoices');

    redirect('/dashboard/invoices');
}



// Use Zod to update the expected types
const UpdateInvoice = FormSchema.omit({ id: true, date: true });

// ...

export async function updateInvoice(id: string, formData: FormData) {

    //This id comes in the bind: updateInvoice.bind(null, invoice.id)
    console.log("id :", id)
    console.log("formData :", formData)

    const { customerId, amount, status } = UpdateInvoice.parse({
        customerId: formData.get('customerId'),
        amount: formData.get('amount'),
        status: formData.get('status'),
    });

    const amountInCents = amount * 100;

    await sql`
        UPDATE invoices
        SET customer_id = ${customerId}, amount = ${amountInCents}, status = ${status}
        WHERE id = ${id}
    `;

    revalidatePath('/dashboard/invoices');
    redirect('/dashboard/invoices');
}



export async function deleteInvoice(id: string) {
    await sql`DELETE FROM invoices WHERE id = ${id}`;
    revalidatePath('/dashboard/invoices');
}